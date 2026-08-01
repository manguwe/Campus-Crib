import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import AmenitiesCheckboxes from '../components/AmenitiesCheckboxes'
import PropertyMediaManager from '../components/PropertyMediaManager'
import { ROOM_TYPE_OPTIONS, BUILDING_TYPE_OPTIONS, STATUS_BADGE_STYLES } from '../lib/constants'

const emptyForm = {
  title: '',
  description: '',
  price: '',
  currency: 'ZMW',
  address_text: '',
  latitude: '',
  longitude: '',
  room_type: 'single',
  amenities: [],
  building_type: '',
  occupancy: '',
  toiletType: 'private', // 'private' | 'shared' — UI-only, maps to toilet_shared_by
  toilet_shared_by: '',
  walk_minutes_to_campus: '',
}

export default function PropertyEditor() {
  const { id } = useParams() // 'new' or an existing property UUID
  const isCreate = id === 'new'
  const { user } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState(emptyForm)
  const [status, setStatus] = useState('pending') // read-only, for display only in edit mode
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
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
        room_type: data.room_type || 'single',
        amenities: data.amenities || [],
        building_type: data.building_type || '',
        occupancy: data.occupancy ?? '',
        toiletType: data.toilet_shared_by ? 'shared' : 'private',
        toilet_shared_by: data.toilet_shared_by ?? '',
        walk_minutes_to_campus: data.walk_minutes_to_campus ?? '',
      })
      setStatus(data.status)
      setLoading(false)
    }

    if (isCreate) loadCreateGuard()
    else loadProperty()
  }, [id, isCreate, user.id])

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
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
      (err) => setError(err.message)
    )
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!form.title.trim() || !form.price) {
      setError('Title and price are required.')
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
      room_type: form.room_type,
      amenities: form.amenities,
      building_type: form.building_type || null,
      occupancy: form.occupancy === '' ? null : Number(form.occupancy),
      toilet_shared_by: form.toiletType === 'shared' ? Number(form.toilet_shared_by) : null,
      walk_minutes_to_campus: form.walk_minutes_to_campus === '' ? null : Number(form.walk_minutes_to_campus),
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
        setError(insertError.message)
        return
      }

      // Move into edit mode for this new property so the media uploader
      // (which needs a real property_id) becomes available immediately.
      navigate(`/landlord/properties/${data.id}`, { replace: true })
      return
    }

    // Edit mode - note `status` is deliberately never in this payload.
    // Even if it were, the properties_protect_status trigger would block
    // a non-admin from changing it (see 02_policies.sql / 07_security_fixes.sql).
    const { error: updateError } = await supabase.from('properties').update(payload).eq('id', id)

    setSaving(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    navigate('/landlord')
  }

  if (loading) {
    return <p className="text-center text-gray-500">Loading…</p>
  }

  if (notFound) {
    return (
      <div className="max-w-lg mx-auto text-center">
        <p className="text-gray-600">That listing doesn't exist, or isn't yours to edit.</p>
        <Link to="/landlord" className="text-sm font-medium text-gray-900 underline mt-2 inline-block">
          Back to dashboard
        </Link>
      </div>
    )
  }

  if (isCreate && verificationStatus !== 'approved') {
    return (
      <div className="max-w-lg mx-auto bg-white rounded-2xl shadow-sm border border-gray-200 p-6 text-center">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Verification required</h2>
        <p className="text-sm text-gray-600">
          {verificationStatus === 'rejected'
            ? 'Your ID verification was rejected. Resubmit your document before creating a listing.'
            : 'You need to be a verified landlord before you can create a listing. Your account is currently ' +
              (verificationStatus || 'unverified') +
              '.'}
        </p>
        <Link
          to="/landlord/verification"
          className="inline-block mt-4 px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-700"
        >
          Go to verification
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-semibold text-gray-900">
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
        {!isCreate && status !== 'approved' && (
          <p className="text-xs text-gray-500 mb-4">
            Edits are saved immediately but don't change moderation status - an admin still needs to
            review this listing.
          </p>
        )}

        <div className="space-y-4 mt-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => updateField('title', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              placeholder="e.g. Sunny single room near campus"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              rows={4}
              value={form.description}
              onChange={(e) => updateField('description', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Price / month</label>
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={form.price}
                onChange={(e) => updateField('price', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
              <input
                type="text"
                value={form.currency}
                onChange={(e) => updateField('currency', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Room type</label>
            <select
              value={form.room_type}
              onChange={(e) => updateField('room_type', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            >
              {ROOM_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Building type</label>
            <select
              value={form.building_type}
              onChange={(e) => updateField('building_type', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            >
              <option value="">Select a building type…</option>
              {BUILDING_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Occupancy</label>
              <input
                type="number"
                min="1"
                step="1"
                value={form.occupancy}
                onChange={(e) => updateField('occupancy', e.target.value)}
                placeholder="e.g. 2"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
              <p className="text-xs text-gray-400 mt-1">How many people this room/unit fits.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Walk time to campus (min)
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={form.walk_minutes_to_campus}
                onChange={(e) => updateField('walk_minutes_to_campus', e.target.value)}
                placeholder="e.g. 5"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
              <p className="text-xs text-gray-400 mt-1">Your own estimate is fine.</p>
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
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={form.toilet_shared_by}
                  onChange={(e) => updateField('toilet_shared_by', e.target.value)}
                  placeholder="people"
                  className="w-24 rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <input
              type="text"
              value={form.address_text}
              onChange={(e) => updateField('address_text', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              placeholder="e.g. Off Great East Road, Lusaka"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">Location (lat/lng)</label>
              <button
                type="button"
                onClick={useMyLocation}
                className="text-xs font-medium text-gray-600 underline"
              >
                Use my current location
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <input
                type="number"
                step="any"
                value={form.latitude}
                onChange={(e) => updateField('latitude', e.target.value)}
                placeholder="Latitude"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
              <input
                type="number"
                step="any"
                value={form.longitude}
                onChange={(e) => updateField('longitude', e.target.value)}
                placeholder="Longitude"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Manual entry for now — swap this for a click-to-pin Google Map once that's wired up;
              these fields will keep working unchanged since they just write to the same
              latitude/longitude columns.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Amenities</label>
            <AmenitiesCheckboxes
              selected={form.amenities}
              onChange={(next) => updateField('amenities', next)}
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg bg-gray-900 text-white py-2 text-sm font-medium hover:bg-gray-700 disabled:opacity-60"
          >
            {saving ? 'Saving…' : isCreate ? 'Create listing' : 'Save changes'}
          </button>
        </div>
      </form>

      {!isCreate && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <PropertyMediaManager propertyId={id} landlordId={user.id} />
        </div>
      )}

      <Link to="/landlord" className="block text-sm text-gray-500 underline text-center">
        Back to dashboard
      </Link>
    </div>
  )
}
