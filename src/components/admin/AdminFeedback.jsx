import { useEffect, useState } from 'react'
import { Star } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { formatSupabaseError } from '../../lib/errorMessages'
import PageLoading from '../ui/PageLoading'
import EmptyState from '../ui/EmptyState'
import ErrorBanner from '../ui/ErrorBanner'

export default function AdminFeedback() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)

  async function load() {
    setLoading(true)
    setError('')
    const { data, error } = await supabase
      .from('feedback')
      .select('id, name, email, message, created_at, is_read, show_as_testimonial')
      .order('created_at', { ascending: false })

    if (error) setError(formatSupabaseError(error, 'Could not load feedback.'))
    else setRows(data)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function toggleField(id, field, currentValue) {
    setBusyId(id)
    const { error: updateError } = await supabase
      .from('feedback')
      .update({ [field]: !currentValue })
      .eq('id', id)
    setBusyId(null)

    if (updateError) {
      setError(formatSupabaseError(updateError, 'Could not update this item.'))
      return
    }
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: !currentValue } : r)))
  }

  if (loading) return <PageLoading label="Loading feedback…" />

  if (rows.length === 0) {
    return <EmptyState title="No feedback yet" description="Messages submitted through the feedback form will show up here." />
  }

  return (
    <div className="space-y-3">
      <ErrorBanner message={error} />

      {rows.map((r) => (
        <div
          key={r.id}
          className={`bg-white rounded-2xl border p-4 ${
            r.is_read ? 'border-gray-200' : 'border-accent/40'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-medium text-gray-900">{r.name || 'Anonymous'}</p>
                {!r.is_read && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-accent/10 text-accent">
                    New
                  </span>
                )}
                {r.show_as_testimonial && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                    <Star size={11} className="fill-current" />
                    Testimonial
                  </span>
                )}
              </div>
              {r.email && <p className="text-xs text-gray-500">{r.email}</p>}
              <p className="text-xs text-gray-400 mt-0.5">{new Date(r.created_at).toLocaleString()}</p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={() => toggleField(r.id, 'show_as_testimonial', r.show_as_testimonial)}
                disabled={busyId === r.id}
                className="text-sm font-medium text-primary hover:underline disabled:opacity-50"
              >
                {r.show_as_testimonial ? 'Unfeature' : 'Feature as testimonial'}
              </button>
              <button
                onClick={() => toggleField(r.id, 'is_read', r.is_read)}
                disabled={busyId === r.id}
                className="text-sm font-medium text-gray-700 hover:underline disabled:opacity-50"
              >
                {r.is_read ? 'Mark unread' : 'Mark read'}
              </button>
            </div>
          </div>
          <p className="text-sm text-gray-700 mt-3 whitespace-pre-wrap break-words">{r.message}</p>
        </div>
      ))}
    </div>
  )
}
