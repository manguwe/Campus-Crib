import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { formatSupabaseError } from '../../lib/errorMessages'
import { REPORT_REASON_LABELS, REPORT_STATUS_BADGE_STYLES } from '../../lib/constants'
import PageLoading from '../ui/PageLoading'
import EmptyState from '../ui/EmptyState'
import ErrorBanner from '../ui/ErrorBanner'

export default function AdminReports() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)

  async function load() {
    setLoading(true)
    setError('')
    // Embeds the reported property's title and the reporter's name via
    // their FK relationships - both readable here since RLS lets an
    // admin read any properties/profiles row (02_policies.sql).
    const { data, error } = await supabase
      .from('property_reports')
      .select(
        'id, reason, details, status, created_at, property_id, properties(id, title), profiles:reporter_id(name)'
      )
      .order('created_at', { ascending: false })

    if (error) setError(formatSupabaseError(error, 'Could not load reports.'))
    else setRows(data)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  // Simple "N reports" signal for a repeatedly-reported listing -
  // counted from what's already loaded rather than a separate query.
  const countsByProperty = rows.reduce((acc, r) => {
    acc[r.property_id] = (acc[r.property_id] || 0) + 1
    return acc
  }, {})

  async function updateStatus(id, status) {
    setBusyId(id)
    const { error: updateError } = await supabase
      .from('property_reports')
      .update({ status })
      .eq('id', id)
    setBusyId(null)

    if (updateError) {
      setError(formatSupabaseError(updateError, 'Could not update this report.'))
      return
    }
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)))
  }

  if (loading) return <PageLoading label="Loading reports…" />

  if (rows.length === 0) {
    return (
      <EmptyState
        title="No reports yet"
        description="Listings reported by students will show up here."
      />
    )
  }

  return (
    <div className="space-y-3">
      <ErrorBanner message={error} />

      {rows.map((r) => {
        const propertyCount = countsByProperty[r.property_id]
        return (
          <div key={r.id} className="bg-white rounded-2xl border border-gray-200 p-4">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-gray-900">
                    {r.properties?.title || 'Listing no longer exists'}
                  </p>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${REPORT_STATUS_BADGE_STYLES[r.status]}`}
                  >
                    {r.status}
                  </span>
                  {propertyCount > 1 && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600">
                      {propertyCount} reports
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {REPORT_REASON_LABELS[r.reason] || r.reason} · Reported by{' '}
                  {r.profiles?.name || 'a user no longer on the platform'}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{new Date(r.created_at).toLocaleString()}</p>
                {r.properties?.id && (
                  <Link
                    to={`/properties/${r.properties.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline mt-1"
                  >
                    View listing
                    <ExternalLink size={11} />
                  </Link>
                )}
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <button
                  onClick={() => updateStatus(r.id, 'reviewed')}
                  disabled={busyId === r.id || r.status === 'reviewed'}
                  className="text-sm font-medium text-gray-700 hover:underline disabled:opacity-40"
                >
                  Mark reviewed
                </button>
                <button
                  onClick={() => updateStatus(r.id, 'dismissed')}
                  disabled={busyId === r.id || r.status === 'dismissed'}
                  className="text-sm font-medium text-red-600 hover:underline disabled:opacity-40"
                >
                  Dismiss
                </button>
              </div>
            </div>

            {r.details && (
              <p className="text-sm text-gray-700 mt-3 whitespace-pre-wrap break-words">{r.details}</p>
            )}
          </div>
        )
      })}
    </div>
  )
}
