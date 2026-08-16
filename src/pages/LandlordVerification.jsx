import { useEffect, useState } from 'react'
import { Loader2, CreditCard, Phone, Mail, MessageCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { uploadLandlordDocument, getIdDocumentSignedUrl } from '../lib/storage'
import { STATUS_BADGE_STYLES } from '../lib/constants'
import { formatSupabaseError } from '../lib/errorMessages'
import PageLoading from '../components/ui/PageLoading'
import ErrorBanner from '../components/ui/ErrorBanner'
import IconInput from '../components/ui/IconInput'

const emptyForm = {
  idNumber: '',
  callNumber: '',
  email: '',
  whatsappNumber: '',
  whatsappSameAsCall: true,
}

export default function LandlordVerification() {
  const { user } = useAuth()

  const [record, setRecord] = useState(null)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(emptyForm)
  const [frontFile, setFrontFile] = useState(null)
  const [backFile, setBackFile] = useState(null)
  const [proofFile, setProofFile] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [signedUrls, setSignedUrls] = useState({})

  async function loadRecord() {
    setLoading(true)
    const [{ data, error }, { data: profileData }] = await Promise.all([
      supabase
        .from('landlord_profiles')
        .select(
          'id, verification_status, id_document_url, id_number, id_document_front_url, id_document_back_url, proof_of_ownership_url, contact_phone, contact_email, contact_whatsapp, verified_at, rejection_reason, created_at'
        )
        .eq('id', user.id)
        .single(),
      supabase.from('profiles').select('phone').eq('id', user.id).single(),
    ])

    if (error) {
      setError(formatSupabaseError(error, 'Could not load your verification status.'))
      setLoading(false)
      return
    }

    setRecord(data)

    // Pre-fill from whatever's already on file - their own previous
    // submission first, falling back to their account phone/email for a
    // first-time submission.
    const prefillCall = data.contact_phone || profileData?.phone || ''
    setForm({
      idNumber: data.id_number || '',
      callNumber: prefillCall,
      email: data.contact_email || user.email || '',
      whatsappNumber: data.contact_whatsapp || prefillCall,
      whatsappSameAsCall: !data.contact_whatsapp || data.contact_whatsapp === prefillCall,
    })

    // Only auto-open the form when there's genuinely nothing submitted
    // yet (a brand-new landlord) or when they've been rejected and need
    // to fix/resubmit. An approved landlord, or one who's already
    // submitted and is just waiting on review, sees the status view
    // instead - not re-prompted to redo anything.
    const hasSubmittedAnything = Boolean(data.id_document_url || data.id_document_front_url)
    setShowForm(data.verification_status === 'rejected' || !hasSubmittedAnything)

    setLoading(false)
  }

  useEffect(() => {
    if (user?.id) loadRecord()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleViewDocument(key, path) {
    if (!path) return
    try {
      const url = await getIdDocumentSignedUrl(path)
      setSignedUrls((prev) => ({ ...prev, [key]: url }))
    } catch (err) {
      setError(formatSupabaseError(err, 'Could not open that document.'))
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!form.idNumber.trim() || !form.callNumber.trim() || !form.email.trim()) {
      setError('Please fill in your ID number, call number, and email.')
      return
    }
    const whatsappNumber = form.whatsappSameAsCall ? form.callNumber : form.whatsappNumber
    if (!whatsappNumber.trim()) {
      setError('Please fill in a WhatsApp number.')
      return
    }
    if (!frontFile || !backFile) {
      setError('Please upload both the front and back of your ID document.')
      return
    }

    setSubmitting(true)
    try {
      const [frontPath, backPath, proofPath] = await Promise.all([
        uploadLandlordDocument(frontFile, user.id, 'front'),
        uploadLandlordDocument(backFile, user.id, 'back'),
        proofFile ? uploadLandlordDocument(proofFile, user.id, 'proof') : Promise.resolve(null),
      ])

      // verification_status is forced back to 'pending' here (and
      // verified_at/verified_by/rejection_reason cleared server-side) by
      // the protect_landlord_verification_fields trigger - see
      // 07_security_fixes.sql / 11_notifications.sql. We still pass it
      // explicitly so the intent is obvious from this call alone.
      const { error: updateError } = await supabase
        .from('landlord_profiles')
        .update({
          id_number: form.idNumber.trim(),
          id_document_front_url: frontPath,
          id_document_back_url: backPath,
          ...(proofPath ? { proof_of_ownership_url: proofPath } : {}),
          contact_phone: form.callNumber.trim(),
          contact_email: form.email.trim(),
          contact_whatsapp: whatsappNumber.trim(),
          verification_status: 'pending',
        })
        .eq('id', user.id)

      if (updateError) throw updateError

      await loadRecord()
      setFrontFile(null)
      setBackFile(null)
      setProofFile(null)
      setShowForm(false)
    } catch (err) {
      setError(formatSupabaseError(err, 'Could not submit your verification. Please try again.'))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <PageLoading label="Loading…" />
  }

  if (!record) {
    return <p className="text-center text-red-600">{error || 'Could not load verification status.'}</p>
  }

  const badge = STATUS_BADGE_STYLES[record.verification_status]
  const hasSubmittedAnything = Boolean(record.id_document_url || record.id_document_front_url)
  const awaitingReview = record.verification_status === 'pending' && hasSubmittedAnything && !showForm

  return (
    <div className="max-w-lg mx-auto bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-primary mb-1">Landlord verification</h2>
      <p className="text-sm text-gray-500 mb-4">
        You must be verified before you can create property listings.
      </p>

      <div className={`inline-flex px-3 py-1.5 rounded-full text-sm font-medium ${badge}`}>
        {record.verification_status === 'pending' && 'Pending review'}
        {record.verification_status === 'approved' && 'Verified'}
        {record.verification_status === 'rejected' && 'Rejected'}
      </div>

      {record.verification_status === 'rejected' && (
        <p className="text-sm text-red-600 mt-3">
          Your submission was rejected
          {record.rejection_reason ? `: ${record.rejection_reason}` : '.'} Please fix and resubmit
          below.
        </p>
      )}

      {record.verification_status === 'approved' && (
        <p className="text-sm text-green-700 mt-3">
          You're verified and can create property listings from your dashboard.
        </p>
      )}

      {awaitingReview && (
        <div className="mt-4 bg-gray-50 border border-gray-200 rounded-xl p-4">
          <p className="text-sm text-gray-700">
            Your verification has been submitted. This usually takes up to 24 hours to review —
            we'll let you know as soon as it's approved.
          </p>
        </div>
      )}

      {hasSubmittedAnything && (
        <div className="mt-4 text-sm space-y-1.5">
          {record.id_document_front_url && (
            <button
              onClick={() => handleViewDocument('front', record.id_document_front_url)}
              className="block text-gray-700 underline"
            >
              View my ID (front)
            </button>
          )}
          {record.id_document_back_url && (
            <button
              onClick={() => handleViewDocument('back', record.id_document_back_url)}
              className="block text-gray-700 underline"
            >
              View my ID (back)
            </button>
          )}
          {record.proof_of_ownership_url && (
            <button
              onClick={() => handleViewDocument('proof', record.proof_of_ownership_url)}
              className="block text-gray-700 underline"
            >
              View my proof of ownership
            </button>
          )}
          {/* Legacy single-document landlords (from before front/back/proof
              existed) still get a way to view what they submitted. */}
          {!record.id_document_front_url && record.id_document_url && (
            <button
              onClick={() => handleViewDocument('legacy', record.id_document_url)}
              className="block text-gray-700 underline"
            >
              View my uploaded document
            </button>
          )}
          {Object.entries(signedUrls).map(([key, url]) => (
            <a key={key} href={url} target="_blank" rel="noreferrer" className="block text-gray-500 break-all">
              {url}
            </a>
          ))}
        </div>
      )}

      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="mt-4 text-sm font-medium text-accent underline"
        >
          {hasSubmittedAnything ? 'Update my documents' : 'Submit verification'}
        </button>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {record.verification_status === 'approved' && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Submitting new documents resets your status to pending until an admin re-reviews it.
            </p>
          )}

          <div className="bg-gray-50 rounded-xl border border-gray-100 p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">NRC or Passport number</label>
              <IconInput
                icon={CreditCard}
                type="text"
                required
                value={form.idNumber}
                onChange={(e) => updateField('idNumber', e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Call number</label>
              <IconInput
                icon={Phone}
                type="tel"
                required
                value={form.callNumber}
                onChange={(e) => updateField('callNumber', e.target.value)}
              />
              <p className="text-xs text-gray-400 mt-1">The number students should reach you on.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <IconInput
                icon={Mail}
                type="email"
                required
                value={form.email}
                onChange={(e) => updateField('email', e.target.value)}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">WhatsApp number</label>
                <label className="flex items-center gap-1.5 text-xs text-gray-500">
                  <input
                    type="checkbox"
                    checked={form.whatsappSameAsCall}
                    onChange={(e) => updateField('whatsappSameAsCall', e.target.checked)}
                    className="rounded border-gray-300 text-accent focus:ring-accent"
                  />
                  Same as call number
                </label>
              </div>
              <IconInput
                icon={MessageCircle}
                type="tel"
                required
                disabled={form.whatsappSameAsCall}
                value={form.whatsappSameAsCall ? form.callNumber : form.whatsappNumber}
                onChange={(e) => updateField('whatsappNumber', e.target.value)}
                className="disabled:bg-gray-100 disabled:text-gray-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ID document — front</label>
            <input
              type="file"
              required
              accept="image/*,.pdf"
              onChange={(e) => setFrontFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ID document — back</label>
            <input
              type="file"
              required
              accept="image/*,.pdf"
              onChange={(e) => setBackFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Proof of property ownership or management{' '}
              <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm"
            />
            <p className="text-xs text-gray-400 mt-1">
              A utility bill, title deed, lease agreement, or signed authorization letter (if
              you're an agent rather than the owner). Including this may speed up approval.
            </p>
          </div>

          <ErrorBanner message={error} />

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-primary text-white py-2 text-sm font-medium hover:bg-primary-dark transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60"
          >
            {submitting ? (
              <span className="inline-flex items-center gap-1.5 justify-center">
                <Loader2 size={14} className="animate-spin" />
                Submitting…
              </span>
            ) : (
              'Submit for review'
            )}
          </button>
        </form>
      )}
    </div>
  )
}
