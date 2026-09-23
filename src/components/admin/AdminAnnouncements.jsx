import { useState } from 'react'
import { Loader2, Megaphone } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { formatSupabaseError } from '../../lib/errorMessages'
import ErrorBanner from '../ui/ErrorBanner'

const AUDIENCE_OPTIONS = [
  { value: 'all', label: 'All users' },
  { value: 'student', label: 'Students only' },
  { value: 'landlord', label: 'Landlords only' },
]

export default function AdminAnnouncements() {
  const [message, setMessage] = useState('')
  const [audience, setAudience] = useState('all')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [sentCount, setSentCount] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSentCount(null)

    if (!message.trim()) {
      setError('Please enter a message.')
      return
    }

    setSending(true)
    // SECURITY DEFINER RPC, not a direct client insert - notifications has
    // no client-facing INSERT policy at all (see 02_policies.sql), so
    // every notification in this project is written server-side.
    const { data, error: rpcError } = await supabase.rpc('admin_broadcast_announcement', {
      p_audience: audience,
      p_message: message.trim(),
    })
    setSending(false)

    if (rpcError) {
      setError(formatSupabaseError(rpcError, 'Could not send the announcement.'))
      return
    }

    setSentCount(data)
    setMessage('')
  }

  return (
    <div className="max-w-lg">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-1">
          <Megaphone size={18} className="text-primary" />
          <h2 className="text-lg font-semibold text-primary">Send an announcement</h2>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Broadcasts a notification to the selected audience via the in-app notification bell.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
            <textarea
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Audience</label>
            <div className="space-y-1.5">
              {AUDIENCE_OPTIONS.map((opt) => (
                <label key={opt.value} className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="radio"
                    name="audience"
                    checked={audience === opt.value}
                    onChange={() => setAudience(opt.value)}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          <ErrorBanner message={error} />

          {sentCount !== null && (
            <p className="text-sm text-accent bg-accent/10 rounded-lg px-3 py-2">
              Sent to {sentCount} {sentCount === 1 ? 'user' : 'users'}.
            </p>
          )}

          <button
            type="submit"
            disabled={sending}
            className="w-full rounded-lg bg-primary text-white py-2 text-sm font-medium hover:bg-primary-dark transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60"
          >
            {sending ? (
              <span className="inline-flex items-center gap-1.5 justify-center">
                <Loader2 size={14} className="animate-spin" />
                Sending…
              </span>
            ) : (
              'Send announcement'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
