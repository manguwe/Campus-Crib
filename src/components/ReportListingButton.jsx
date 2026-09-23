import { useEffect, useState } from 'react'
import { Flag, X, Loader2, CheckCircle2 } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { formatSupabaseError } from '../lib/errorMessages'
import { REPORT_REASON_OPTIONS } from '../lib/constants'
import ErrorBanner from './ui/ErrorBanner'

/** Subtle "Report this listing" text link + modal, shown only to a
 * logged-in student viewing someone else's listing (role check happens
 * in the parent, PropertyDetail.jsx). Checks for an existing pending
 * report from this student on this property before offering the
 * button, so the same person can't submit duplicates in quick
 * succession. */
export default function ReportListingButton({ propertyId, userId }) {
  const [checking, setChecking] = useState(true)
  const [alreadyReported, setAlreadyReported] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function checkExisting() {
      setChecking(true)
      // RLS lets a reporter read their own rows (see
      // 19_property_reports_table.sql), so this only ever returns this
      // student's own pending report on this listing, if any.
      const { data } = await supabase
        .from('property_reports')
        .select('id')
        .eq('property_id', propertyId)
        .eq('reporter_id', userId)
        .eq('status', 'pending')
        .limit(1)

      if (!cancelled) {
        setAlreadyReported((data || []).length > 0)
        setChecking(false)
      }
    }

    checkExisting()
    return () => {
      cancelled = true
    }
  }, [propertyId, userId])

  if (checking) return null

  if (alreadyReported) {
    return <p className="text-xs text-gray-400">You've already reported this listing.</p>
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-gray-600"
      >
        <Flag size={12} />
        Report this listing
      </button>

      {open && (
        <ReportModal
          propertyId={propertyId}
          userId={userId}
          onClose={() => setOpen(false)}
          onSubmitted={() => {
            setOpen(false)
            setAlreadyReported(true)
          }}
        />
      )}
    </>
  )
}

function ReportModal({ propertyId, userId, onClose, onSubmitted }) {
  const [reason, setReason] = useState('')
  const [details, setDetails] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!reason) {
      setError('Please choose a reason.')
      return
    }

    setSubmitting(true)
    // reporter_id must be set explicitly to the current user's id - the
    // property_reports INSERT policy's WITH CHECK is
    // `reporter_id = auth.uid()` (19_property_reports_table.sql), same
    // pattern as favourites' student_id. Leaving it unset sends NULL,
    // which never equals auth.uid() and gets rejected by RLS.
    const { error: insertError } = await supabase.from('property_reports').insert({
      property_id: propertyId,
      reporter_id: userId,
      reason,
      details: details.trim() || null,
    })
    setSubmitting(false)

    if (insertError) {
      setError(formatSupabaseError(insertError, 'Could not submit your report. Please try again.'))
      return
    }

    setSubmitted(true)
    // Brief confirmation, then close and let the parent flip to the
    // "already reported" state.
    setTimeout(() => onSubmitted(), 1400)
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <p className="font-medium text-gray-900">Report this listing</p>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors duration-150"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-5">
          {submitted ? (
            <div className="text-center py-4">
              <div className="inline-flex bg-accent/10 rounded-full p-3 mb-3">
                <CheckCircle2 size={22} className="text-accent" />
              </div>
              <p className="font-medium text-gray-900">Thanks — we'll take a look</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  What's wrong with this listing?
                </label>
                <div className="space-y-2">
                  {REPORT_REASON_OPTIONS.map((opt) => (
                    <label key={opt.value} className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="radio"
                        name="reportReason"
                        checked={reason === opt.value}
                        onChange={() => setReason(opt.value)}
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Anything else we should know? <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  rows={3}
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>

              <ErrorBanner message={error} />

              <button
                type="submit"
                disabled={!reason || submitting}
                className="w-full rounded-lg bg-primary text-white py-2 text-sm font-medium hover:bg-primary-dark transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60"
              >
                {submitting ? (
                  <span className="inline-flex items-center gap-1.5 justify-center">
                    <Loader2 size={14} className="animate-spin" />
                    Submitting…
                  </span>
                ) : (
                  'Submit report'
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
