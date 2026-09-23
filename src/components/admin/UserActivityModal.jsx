import { useEffect, useState } from 'react'
import { X, AlertTriangle } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { formatSupabaseError } from '../../lib/errorMessages'
import { summarizeActivity } from '../../lib/activitySummary'
import Spinner from '../ui/Spinner'
import ErrorBanner from '../ui/ErrorBanner'
import EmptyState from '../ui/EmptyState'

const EVENT_BADGE_STYLES = {
  page_view: 'bg-gray-100 text-gray-600',
  login: 'bg-primary/10 text-primary',
  logout: 'bg-gray-100 text-gray-600',
  signup: 'bg-primary/10 text-primary',
  listing_created: 'bg-accent/10 text-accent',
  listing_updated: 'bg-accent/10 text-accent',
  favourite_added: 'bg-red-50 text-red-600',
  favourite_removed: 'bg-gray-100 text-gray-600',
  review_submitted: 'bg-amber-50 text-amber-700',
  search_performed: 'bg-blue-50 text-blue-700',
  error: 'bg-red-100 text-red-700',
}

export default function UserActivityModal({ user, onClose }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      const { data, error: loadError } = await supabase
        .from('activity_logs')
        .select('id, event_type, path, details, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(200)

      if (cancelled) return
      if (loadError) setError(formatSupabaseError(loadError, 'Could not load activity.'))
      else setRows(data)
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [user.id])

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0">
          <div>
            <p className="font-medium text-gray-900">{user.name}'s activity</p>
            <p className="text-xs text-gray-400">Most recent 200 events, newest first</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors duration-150"
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4">
          {loading ? (
            <Spinner label="Loading activity…" />
          ) : error ? (
            <ErrorBanner message={error} />
          ) : rows.length === 0 ? (
            <EmptyState title="No activity logged yet" description="Nothing has been recorded for this user." />
          ) : (
            <ul className="space-y-2">
              {rows.map((r) => {
                const summary = summarizeActivity(r.event_type, r.details)
                return (
                  <li key={r.id} className="flex items-start gap-3 text-sm border-b border-gray-100 pb-2 last:border-0">
                    {r.event_type === 'error' && (
                      <AlertTriangle size={14} className="text-red-500 mt-1 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${
                            EVENT_BADGE_STYLES[r.event_type] || 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {r.event_type}
                        </span>
                        {r.path && <span className="text-gray-500 text-xs truncate">{r.path}</span>}
                      </div>
                      {summary && <p className="text-gray-600 mt-1 break-words">{summary}</p>}
                    </div>
                    <span className="text-xs text-gray-400 shrink-0 whitespace-nowrap">
                      {new Date(r.created_at).toLocaleString()}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
