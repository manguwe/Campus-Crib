import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { uploadIdDocument, getIdDocumentSignedUrl } from '../lib/storage'
import { STATUS_BADGE_STYLES } from '../lib/constants'

export default function LandlordVerification() {
  const { user } = useAuth()

  const [record, setRecord] = useState(null)
  const [loading, setLoading] = useState(true)
  const [file, setFile] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [signedUrl, setSignedUrl] = useState('')

  async function loadRecord() {
    setLoading(true)
    const { data, error } = await supabase
      .from('landlord_profiles')
      .select('id, verification_status, id_document_url, verified_at, created_at')
      .eq('id', user.id)
      .single()
    if (error) {
      setError(error.message)
    } else {
      setRecord(data)
      setShowForm(!data.id_document_url) // no doc yet -> show the form straight away
    }
    setLoading(false)
  }

  useEffect(() => {
    if (user?.id) loadRecord()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  async function handleViewDocument() {
    if (!record?.id_document_url) return
    try {
      const url = await getIdDocumentSignedUrl(record.id_document_url)
      setSignedUrl(url)
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!file) {
      setError('Choose a file to upload first.')
      return
    }

    setSubmitting(true)
    try {
      const path = await uploadIdDocument(file, user.id)

      // verification_status is forced back to 'pending' here (and
      // verified_at/verified_by cleared server-side) by the
      // protect_landlord_verification_fields trigger - see
      // 07_security_fixes.sql. We still pass it explicitly so the intent
      // is obvious from this call alone.
      const { error: updateError } = await supabase
        .from('landlord_profiles')
        .update({ id_document_url: path, verification_status: 'pending' })
        .eq('id', user.id)

      if (updateError) throw updateError

      await loadRecord()
      setFile(null)
      setShowForm(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <p className="text-center text-gray-500">Loading…</p>
  }

  if (!record) {
    return <p className="text-center text-red-600">{error || 'Could not load verification status.'}</p>
  }

  const badge = STATUS_BADGE_STYLES[record.verification_status]

  return (
    <div className="max-w-lg mx-auto bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Landlord verification</h2>
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
          Your document was rejected. Upload a clearer copy of your ID to resubmit for review.
        </p>
      )}

      {record.verification_status === 'approved' && (
        <p className="text-sm text-green-700 mt-3">
          You're verified and can create property listings from your dashboard.
        </p>
      )}

      {record.id_document_url && (
        <div className="mt-4 text-sm">
          <button onClick={handleViewDocument} className="text-gray-700 underline">
            View my uploaded document
          </button>
          {signedUrl && (
            <a
              href={signedUrl}
              target="_blank"
              rel="noreferrer"
              className="block mt-2 text-gray-500 break-all"
            >
              {signedUrl}
            </a>
          )}
        </div>
      )}

      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="mt-4 text-sm font-medium text-gray-900 underline"
        >
          {record.id_document_url ? 'Replace document' : 'Upload document'}
        </button>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          {record.verification_status === 'approved' && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Uploading a new document resets your status to pending until an admin re-reviews it.
            </p>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ID document (image or PDF)
            </label>
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-gray-900 text-white py-2 text-sm font-medium hover:bg-gray-700 disabled:opacity-60"
          >
            {submitting ? 'Uploading…' : 'Submit for review'}
          </button>
        </form>
      )}
    </div>
  )
}
