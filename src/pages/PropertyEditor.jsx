import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import {
  Loader2,
  Sparkles,
  Home as HomeIcon,
  Banknote,
  Coins,
  Clock,
  MapPin,
  Users,
  Building2,
  Lock,
  CheckCircle2,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import AmenitiesCheckboxes from '../components/AmenitiesCheckboxes'
import PropertyMediaManager from '../components/PropertyMediaManager'
import PropertyContactsManager from '../components/PropertyContactsManager'
import LocationPicker from '../components/LocationPicker'
import { BUILDING_TYPE_OPTIONS, OCCUPANCY_OPTIONS, STATUS_BADGE_STYLES, AMENITY_OPTIONS } from '../lib/constants'
import { formatSupabaseError } from '../lib/errorMessages'
import { logActivity } from '../lib/activityLog'
import PageLoading from '../components/ui/PageLoading'
import ErrorBanner from '../components/ui/ErrorBanner'
import Select from '../components/ui/Select'
import IconInput from '../components/ui/IconInput'
import AvailabilityStatusControl from '../components/AvailabilityStatusControl'
import { useCampuses } from '../context/CampusesContext'

const AI_COOLDOWN_SECONDS = 8

const emptyForm = {
  title: '',
  description: '',
  price: '',
  currency: 'ZMW',
  address_text: '',
  latitude: '',
  longitude: '',
  amenities: [],
  building_type: '',
  occupancy: '',
  toiletType: 'private', // 'private' | 'shared' — UI-only, maps to toilet_shared_by
  toilet_shared_by: '',
  walk_minutes_to_campus: '',
  primary_campus_id: '',
  availability_status: 'available',
}

export default function PropertyEditor() {
  const { id } = useParams() // 'new' or an existing property UUID
  const isCreate = id === 'new'
  const { user } = useAuth()
  const { campuses } = useCampuses()
  const navigate = useNavigate()

  const [form, setForm] = useState(emptyForm)
  const [status, setStatus] = useState('pending') // read-only, for display only in edit mode
  const [rejectionReason, setRejectionReason] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Step-flow tracking (Part 4): wasCreateRef captures whether THIS page
  // visit started as a brand-new listing (set once, on mount, never
  // updated again). When isCreate later flips to false - i.e. the
  // create-then-navigate below completes and the property has loaded -
  // we show a one-time "unlocked" confirmation and scroll to the
  // Photos/Contacts section. Editing a pre-existing listing later never
  // triggers this, since wasCreateRef starts false on that visit.
  const wasCreateRef = useRef(isCreate)
  const unlockHandledRef = useRef(false)
  const unlockedSectionRef = useRef(null)
  const [justUnlocked, setJustUnlocked] = useState(false)

  useEffect(() => {
    if (wasCreateRef.current && !isCreate && !loading && !unlockHandledRef.current) {
      unlockHandledRef.current = true
      setJustUnlocked(true)
      requestAnimationFrame(() => {
        unlockedSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCreate, loading])
  const [error, setError] = useState('')
  const [notFound, setNotFound] = useState(false)
  const [verificationStatus, setVerificationStatus] = useState(null)

  useEffect(() => {
    async function loadCreateGuard() {
      // A pending/rejected landlord could still type this URL directly
      // even though the dashboard hides the "+ New listing" link - check
      // their verification status here too, so the UI blocks it clearly
      // instead of letting them fill out a form that will fail at the
      // database with an opaque RLS error on submit. The database check
      // (properties INSERT policy, 07_security_fixes.sql) remains the
      // real security boundary either way.
      setLoading(true)
      const { data, error } = await supabase
        .from('landlord_profiles')
        .select('verification_status')
        .eq('id', user.id)
        .single()
      if (!error) setVerificationStatus(data.verification_status)
      setLoading(false)
    }

    async function loadProperty() {
      setLoading(true)
      // RLS restricts this to properties the current user owns (or any
      // approved one) - if this id belongs to someone else's non-approved
      // listing, `data` comes back null rather than leaking the row.
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .eq('id', id)
        .single()

      if (error || !data) {
        setNotFound(true)
        setLoading(false)
        return
      }

      setForm({
        title: data.title || '',
        description: data.description || '',
        price: data.price ?? '',
        currency: data.currency || 'ZMW',
        address_text: data.address_text || '',
        latitude: data.latitude ?? '',
        longitude: data.longitude ?? '',
        amenities: data.amenities || [],
        building_type: data.building_type || '',
        occupancy: data.occupancy ?? '',
        toiletType: data.toilet_shared_by ? 'shared' : 'private',
        toilet_shared_by: data.toilet_shared_by ?? '',
        walk_minutes_to_campus: data.walk_minutes_to_campus ?? '',
        primary_campus_id: data.primary_campus_id || '',
        availability_status: data.availability_status || 'available',
      })
      setStatus(data.status)
      setRejectionReason(data.rejection_reason)
      setLoading(false)
    }

    if (isCreate) loadCreateGuard()
    else loadProperty()
  }, [id, isCreate, user.id])

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const [aiGenerating, setAiGenerating] = useState(false)
  const [aiError, setAiError] = useState('')
  const [aiCooldown, setAiCooldown] = useState(0)

  useEffect(() => {
    if (aiCooldown <= 0) return
    const timer = setInterval(() => setAiCooldown((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(timer)
  }, [aiCooldown])

  const canGenerateDescription = Boolean(form.title.trim() && form.price && form.building_type)

  async function handleGenerateDescription() {
    setAiError('')

    if (form.description.trim().length > 0) {
      const confirmed = window.confirm(
        "Replace your current description with an AI-generated one? This will overwrite what you've written."
      )
      if (!confirmed) return
    }

    setAiGenerating(true)

    const amenityLabels = form.amenities
      .map((value) => AMENITY_OPTIONS.find((opt) => opt.value === value)?.label)
      .filter(Boolean)

    // Calls the generate-listing-description Edge Function - never the
    // Groq API directly, so the GROQ_API_KEY secret never reaches the
    // browser. See supabase/functions/generate-listing-description/index.ts.
    const { data, error: invokeError } = await supabase.functions.invoke('generate-listing-description', {
      body: {
        title: form.title,
        building_type: form.building_type,
        occupancy: form.occupancy,
        price: form.price,
        currency: form.currency,
        toiletType: form.toiletType,
        toilet_shared_by: form.toiletType === 'shared' ? form.toilet_shared_by : null,
        walk_minutes_to_campus: form.walk_minutes_to_campus,
        address: form.address_text,
        amenities: amenityLabels,
      },
    })

    setAiGenerating(false)
    setAiCooldown(AI_COOLDOWN_SECONDS)

    const fallbackMessage = "Couldn't generate a description right now — please write one manually or try again."

    if (invokeError) {
      let message = fallbackMessage
      try {
        const body = await invokeError.context.json()
        if (body?.error) message = body.error
      } catch {
        // Edge Function unreachable or returned a non-JSON body - keep the fallback message.
      }
      setAiError(message)
      return
    }

    if (data?.description) {
      updateField('description', data.description)
      logActivity('ai_description_generated')
    } else {
      setAiError(fallbackMessage)
    }
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setError('Geolocation is not available in this browser.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        updateField('latitude', pos.coords.latitude.toFixed(6))
        updateField('longitude', pos.coords.longitude.toFixed(6))
      },
      (err) => setError(formatSupabaseError(err, 'Could not get your location.'))
    )
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!form.title.trim() || !form.price) {
      setError('Title and price are required.')
      return
    }

    if (Number(form.price) <= 0) {
      setError('Price must be greater than zero.')
      return
    }

    if (form.latitude !== '' && (Number(form.latitude) < -90 || Number(form.latitude) > 90)) {
      setError('Latitude must be between -90 and 90.')
      return
    }

    if (form.longitude !== '' && (Number(form.longitude) < -180 || Number(form.longitude) > 180)) {
      setError('Longitude must be between -180 and 180.')
      return
    }

    if ((form.latitude === '') !== (form.longitude === '')) {
      setError('Enter both latitude and longitude, or leave both blank.')
      return
    }

    if (form.occupancy !== '' && Number(form.occupancy) < 1) {
      setError('Occupancy must be at least 1.')
      return
    }

    if (form.toiletType === 'shared' && !form.toilet_shared_by) {
      setError('Enter how many people share the toilet, or switch to "Private".')
      return
    }

    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      price: Number(form.price),
      currency: form.currency,
      address_text: form.address_text.trim() || null,
      latitude: form.latitude === '' ? null : Number(form.latitude),
      longitude: form.longitude === '' ? null : Number(form.longitude),
      amenities: form.amenities,
      building_type: form.building_type || null,
      occupancy: form.occupancy === '' ? null : Number(form.occupancy),
      toilet_shared_by: form.toiletType === 'shared' ? Number(form.toilet_shared_by) : null,
      walk_minutes_to_campus: form.walk_minutes_to_campus === '' ? null : Number(form.walk_minutes_to_campus),
      primary_campus_id: form.primary_campus_id || null,
      availability_status: form.availability_status,
    }

    setSaving(true)

    if (isCreate) {
      const { data, error: insertError } = await supabase
        .from('properties')
        .insert({ ...payload, landlord_id: user.id, status: 'pending' })
        .select('id')
        .single()

      setSaving(false)

      if (insertError) {
        setError(formatSupabaseError(insertError, 'Could not create this listing.'))
        return
      }

      // Move into edit mode for this new property so the media uploader
      // (which needs a real property_id) becomes available immediately.
      logActivity('listing_created', { details: { property_id: data.id } })
      navigate(`/landlord/properties/${data.id}`, { replace: true })
      return
    }

    // Edit mode - note the moderation `status` (pending/approved/rejected)
    // is deliberately never in this payload, unlike `availability_status`
    // above which a landlord can freely change. Even if `status` were
    // included, the properties_protect_status trigger would block a
    // non-admin from changing it (see 02_policies.sql / 07_security_fixes.sql).
    const { error: updateError } = await supabase.from('properties').update(payload).eq('id', id)

    setSaving(false)

    if (updateError) {
      setError(formatSupabaseError(updateError, 'Could not save changes.'))
      return
    }

    logActivity('listing_updated', { details: { property_id: id } })
    navigate('/landlord')
  }

  if (loading) {
    return <PageLoading label="Loading…" />
  }

  if (notFound) {
    return (
      <div className="max-w-lg mx-auto text-center">
        <p className="text-gray-600">That listing doesn't exist, or isn't yours to edit.</p>
        <Link to="/landlord" className="text-sm font-medium text-accent underline mt-2 inline-block">
          Back to dashboard
        </Link>
      </div>
    )
  }

  if (isCreate && verificationStatus !== 'approved') {
    return (
      <div className="max-w-lg mx-auto bg-white rounded-2xl shadow-sm border border-gray-200 p-6 text-center">
        <h2 className="text-lg font-semibold text-primary mb-2">Verification required</h2>
        <p className="text-sm text-gray-600">
          {verificationStatus === 'rejected'
            ? 'Your ID verification was rejected. Resubmit your document before creating a listing.'
            : 'You need to be a verified landlord before you can create a listing. Your account is currently ' +
              (verificationStatus || 'unverified') +
              '.'}
        </p>
        <Link
          to="/landlord/verification"
          className="inline-block mt-4 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark transition-all duration-150 hover:scale-[1.02] active:scale-[0.98]"
        >
          Go to verification
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {(isCreate || justUnlocked) && (
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-white text-xs font-semibold shrink-0">
            {isCreate ? 1 : 2}
          </span>
          <p className="text-sm font-medium text-gray-700">
            {isCreate ? 'Step 1 of 2: Listing details' : 'Step 2 of 2: Photos & contact numbers'}
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-semibold text-primary">
            {isCreate ? 'Create a listing' : 'Edit listing'}
          </h2>
          {!isCreate && (
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_BADGE_STYLES[status]}`}
            >
              {status}
            </span>
          )}
        </div>
        {!isCreate && status === 'rejected' && rejectionReason && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
            Rejected: {rejectionReason}
          </p>
        )}
        {!isCreate && status !== 'approved' && (
          <p className="text-xs text-gray-500 mb-4">
            Edits are saved immediately but don't change moderation status - an admin still needs to
            review this listing.
          </p>
        )}

        <div className="mb-2">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Availability</label>
          <AvailabilityStatusControl
            value={form.availability_status}
            onChange={(value) => updateField('availability_status', value)}
          />
        </div>

        <div className="space-y-5 mt-4">
          {/* Basics */}
          <div className="bg-gray-50 rounded-xl border border-gray-100 p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <IconInput
                icon={HomeIcon}
                type="text"
                required
                value={form.title}
                onChange={(e) => updateField('title', e.target.value)}
                placeholder="e.g. Sunny single room near campus"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <button
                  type="button"
                  onClick={handleGenerateDescription}
                  disabled={!canGenerateDescription || aiGenerating || aiCooldown > 0}
                  title={
                    !canGenerateDescription
                      ? 'Fill in a title, price, and building type first'
                      : undefined
                  }
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline disabled:text-gray-300 disabled:no-underline disabled:cursor-not-allowed"
                >
                  {aiGenerating ? (
                    <>
                      <Loader2 size={12} className="animate-spin" />
                      Generating…
                    </>
                  ) : (
                    <>
                      <Sparkles size={12} />
                      {aiCooldown > 0 ? `Generate with AI (${aiCooldown}s)` : 'Generate with AI'}
                    </>
                  )}
                </button>
              </div>
              <textarea
                rows={4}
                value={form.description}
                onChange={(e) => updateField('description', e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors duration-150"
              />
              <p className="text-xs text-gray-400 mt-1">
                AI-generated text is a starting point — read it over and edit it however you like.
              </p>
              {aiError && <p className="text-xs text-red-600 mt-1">{aiError}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Price / month</label>
                <IconInput
                  icon={Banknote}
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={form.price}
                  onChange={(e) => updateField('price', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                <IconInput
                  icon={Coins}
                  type="text"
                  value={form.currency}
                  onChange={(e) => updateField('currency', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="bg-gray-50 rounded-xl border border-gray-100 p-4 space-y-4">
            <div>
              <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1">
                <Building2 size={14} className="text-gray-400" />
                Building type
              </label>
              <Select
                value={form.building_type}
                onChange={(e) => updateField('building_type', e.target.value)}
                  >
                <option value="">Select a building type…</option>
                {BUILDING_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1">
                  <Users size={14} className="text-gray-400" />
                  Occupancy
                </label>
                <Select
                  value={form.occupancy}
                  onChange={(e) => updateField('occupancy', e.target.value)}
                      >
                  <option value="">Select…</option>
                  {OCCUPANCY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
                <p className="text-xs text-gray-400 mt-1">How many people this room/unit fits.</p>
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1">
                  <Clock size={14} className="text-gray-400" />
                  Walk time to campus (min)
                </label>
                <IconInput
                  icon={Clock}
                  type="number"
                  min="0"
                  step="1"
                  value={form.walk_minutes_to_campus}
                  onChange={(e) => updateField('walk_minutes_to_campus', e.target.value)}
                  placeholder="e.g. 5"
                />
                <p className="text-xs text-gray-400 mt-1">Your own estimate is fine.</p>
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1">
                  <MapPin size={14} className="text-gray-400" />
                  Nearest/primary campus
                </label>
                <Select
                  value={form.primary_campus_id}
                  onChange={(e) => updateField('primary_campus_id', e.target.value)}
                >
                  <option value="">Not specified</option>
                  {campuses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
                <p className="text-xs text-gray-400 mt-1">
                  Which campus the walk-time estimate above refers to.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Toilet</label>
              <div className="flex items-center gap-4 text-sm text-gray-700">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="toiletType"
                    checked={form.toiletType === 'private'}
                    onChange={() => {
                      updateField('toiletType', 'private')
                      updateField('toilet_shared_by', '')
                    }}
                  />
                  Private
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="toiletType"
                    checked={form.toiletType === 'shared'}
                    onChange={() => updateField('toiletType', 'shared')}
                  />
                  Shared by
                </label>
                {form.toiletType === 'shared' && (
                  <div className="w-28">
                    <IconInput
                      icon={Users}
                      type="number"
                      min="1"
                      step="1"
                      value={form.toilet_shared_by}
                      onChange={(e) => updateField('toilet_shared_by', e.target.value)}
                      placeholder="people"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Address & location */}
          <div className="bg-gray-50 rounded-xl border border-gray-100 p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <IconInput
                icon={MapPin}
                type="text"
                value={form.address_text}
                onChange={(e) => updateField('address_text', e.target.value)}
                placeholder="e.g. Off Great East Road, Lusaka"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
              <LocationPicker
                latitude={form.latitude}
                longitude={form.longitude}
                onPick={(lat, lng) => {
                  updateField('latitude', lat)
                  updateField('longitude', lng)
                }}
                onUseMyLocation={useMyLocation}
              />

              <details className="mt-3 group">
                <summary className="text-xs font-medium text-gray-600 cursor-pointer select-none">
                  Enter coordinates manually instead
                </summary>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <IconInput
                    type="number"
                    step="any"
                    value={form.latitude}
                    onChange={(e) => updateField('latitude', e.target.value)}
                    placeholder="Latitude"
                  />
                  <IconInput
                    type="number"
                    step="any"
                    value={form.longitude}
                    onChange={(e) => updateField('longitude', e.target.value)}
                    placeholder="Longitude"
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Useful as a fallback if the map above doesn't load for you.
                </p>
              </details>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Amenities</label>
            <AmenitiesCheckboxes
              selected={form.amenities}
              onChange={(next) => updateField('amenities', next)}
            />
          </div>

          <ErrorBanner message={error} />

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg bg-primary text-white py-2 text-sm font-medium hover:bg-primary-dark transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60"
          >
            {saving ? (
              <span className="inline-flex items-center gap-1.5"><Loader2 size={14} className="animate-spin" />Saving…</span>
            ) : isCreate ? 'Create listing' : 'Save changes'}
          </button>
        </div>
      </form>

      {isCreate ? (
        <div className="bg-gray-50 rounded-2xl border border-dashed border-gray-300 p-8 text-center">
          <div className="inline-flex bg-gray-200 rounded-full p-3 mb-3">
            <Lock size={20} className="text-gray-400" />
          </div>
          <p className="text-sm font-medium text-gray-500 max-w-sm mx-auto">
            Save your listing details above first — then you'll be able to add photos and contact
            numbers here.
          </p>
        </div>
      ) : (
        <div ref={unlockedSectionRef} className="space-y-6 scroll-mt-20">
          {justUnlocked && (
            <div className="flex items-center gap-2 bg-accent/10 text-accent text-sm font-medium rounded-xl px-4 py-3">
              <CheckCircle2 size={16} className="shrink-0" />
              Details saved — now add your photos and contact info below.
            </div>
          )}
          <div className="bg-primary/5 rounded-2xl shadow-sm border border-primary/10 p-6">
            <PropertyContactsManager propertyId={id} />
          </div>
          <div className="bg-accent/5 rounded-2xl shadow-sm border border-accent/10 p-6">
            <PropertyMediaManager propertyId={id} landlordId={user.id} />
          </div>
        </div>
      )}

      <Link to="/landlord" className="block text-sm text-gray-500 underline text-center">
        Back to dashboard
      </Link>
    </div>
  )
}
