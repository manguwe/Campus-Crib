import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabaseClient'
import { getIdDocumentSignedUrl } from '../../lib/storage'
import { formatSupabaseError } from '../../lib/errorMessages'
import PageLoading from '../ui/PageLoading'
import EmptyState from '../ui/EmptyState'
import ErrorBanner from '../ui/ErrorBanner'

export default function AdminVerifications() {
  const { user } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)

  async function load() {
    setLoading(true)
    setError('')
    // Single-hop embed: landlord_profiles.id has a FK to profiles.id.
    // landlord_profiles has TWO foreign keys into profiles: `id` (the
    // landlord) and `verified_by` (the admin who verified them). Without
    // an explicit hint, PostgREST can't tell which one "profiles(...)"
    // should follow and errors with "more than one relationship was
    // found". landlord_profiles_id_fkey is the constraint on the `id`
    // column (see 01_schema.sql), which is the one we want here - the
    // landlord being reviewed, not the admin.
    const { data, error } = await supabase
      .from('landlord_profiles')
      .select(
        'id, verification_status, id_document_url, id_number, id_document_front_url, id_document_back_url, proof_of_ownership_url, contact_phone, contact_email, contact_whatsapp, created_at, profiles!landlord_profiles_id_fkey(name, phone)'
      )
      .eq('verification_status', 'pending')
      .order('created_at', { ascending: true })

    if (error) setError(formatSupabaseError(error, 'Could not load pending verifications.'))
    else setRows(data)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function handleViewDocument(path) {
    try {
      const url = await getIdDocumentSignedUrl(path)
      window.open(url, '_blank', 'noopener')
    } catch (err) {
      setError(formatSupabaseError(err, 'Could not open that document.'))
    }
  }

  async function handleDecision(landlordId, decision) {
    let reason = null
    if (decision === 'rejected') {
      reason = window.prompt('Reason for rejecting this verification (shown to the landlord):') || ''
      if (reason === null) return // cancelled
    }

    setBusyId(landlordId)
    const { error: updateError } = await supabase
      .from('landlord_profiles')
      .update({
        verification_status: decision,
        verified_at: new Date().toISOString(),
        verified_by: user.id,
        rejection_reason: decision === 'rejected' ? reason : null,
      })
      .eq('id', landlordId)
    setBusyId(null)

    if (updateError) {
      setError(formatSupabaseError(updateError, 'Could not save that decision.'))
      return
    }

    setRows((prev) => prev.filter((r) => r.id !== landlordId))
  }

  if (loading) return <PageLoading label="Loading pending verifications…" />

  return (
    <div className="space-y-3">
      <ErrorBanner message={error} />

      {rows.length === 0 && (
        <EmptyState title="No pending verifications" description="New landlord sign-ups needing ID review will show up here." />
      )}

      {rows.map((r) => {
        const hasNewDocs = Boolean(r.id_document_front_url)
        return (
          <div
            key={r.id}
            className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4"
          >
            <div className="min-w-0">
              <p className="font-medium text-gray-900 truncate">{r.profiles?.name}</p>
              <p className="text-sm text-gray-500">{r.profiles?.phone}</p>

              {hasNewDocs ? (
                <div className="text-xs text-gray-500 mt-2 space-y-0.5">
                  {r.id_number && <p>ID number: <span className="text-gray-700">{r.id_number}</span></p>}
                  {r.contact_phone && <p>Call: <span className="text-gray-700">{r.contact_phone}</span></p>}
                  {r.contact_email && <p>Email: <span className="text-gray-700">{r.contact_email}</span></p>}
                  {r.contact_whatsapp && (
                    <p>WhatsApp: <span className="text-gray-700">{r.contact_whatsapp}</span></p>
                  )}
                </div>
              ) : null}

              <p className="text-xs text-gray-400 mt-1">
                Submitted {new Date(r.created_at).toLocaleDateString()}
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap shrink-0">
              {hasNewDocs ? (
                <>
                  <button
                    onClick={() => handleViewDocument(r.id_document_front_url)}
                    className="text-sm font-medium text-gray-700 underline"
                  >
                    View ID (front)
                  </button>
                  <button
                    onClick={() => handleViewDocument(r.id_document_back_url)}
                    className="text-sm font-medium text-gray-700 underline"
                  >
                    View ID (back)
                  </button>
                  {r.proof_of_ownership_url && (
                    <button
                      onClick={() => handleViewDocument(r.proof_of_ownership_url)}
                      className="text-sm font-medium text-gray-700 underline"
                    >
                      View proof of ownership
                    </button>
                  )}
                </>
              ) : (
                // Older record that still only has the legacy single
                // document - handle gracefully rather than a broken
                // empty state.
                r.id_document_url && (
                  <button
                    onClick={() => handleViewDocument(r.id_document_url)}
                    className="text-sm font-medium text-gray-700 underline"
                  >
                    View ID
                  </button>
                )
              )}
              <button
                onClick={() => handleDecision(r.id, 'approved')}
                disabled={busyId === r.id}
                className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-60"
              >
                Approve
              </button>
              <button
                onClick={() => handleDecision(r.id, 'rejected')}
                disabled={busyId === r.id}
                className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-60"
              >
                Reject
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
