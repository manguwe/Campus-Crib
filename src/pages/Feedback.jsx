import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { formatSupabaseError } from '../lib/errorMessages'
import ErrorBanner from '../components/ui/ErrorBanner'
import { CheckCircle2, Loader2 } from 'lucide-react'

export default function Feedback() {
  const { user, profile } = useAuth()

  const [name, setName] = useState(profile?.name || '')
  const [email, setEmail] = useState(user?.email || '')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!message.trim()) {
      setError('Please enter a message.')
      return
    }
    if (message.trim().length > 2000) {
      setError('Message must be under 2000 characters.')
      return
    }
    if (email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('Please enter a valid email address, or leave it blank.')
      return
    }

    setSubmitting(true)
    const { error: insertError } = await supabase.from('feedback').insert({
      submitted_by: user?.id || null,
      name: name.trim() || null,
      email: email.trim() || null,
      message: message.trim(),
    })
    setSubmitting(false)

    if (insertError) {
      setError(formatSupabaseError(insertError, 'Could not submit your feedback. Please try again.'))
      return
    }

    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="max-w-md mx-auto text-center bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
        <div className="inline-flex bg-accent/10 rounded-full p-3 mb-3">
          <CheckCircle2 size={22} className="text-accent" />
        </div>
        <p className="font-medium text-gray-900">Thanks for letting us know</p>
        <p className="text-sm text-gray-500 mt-1">Your feedback has been submitted.</p>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-bold text-primary mb-1">Feedback</h1>
      <p className="text-sm text-gray-500 mb-6">
        Found a bug, have an idea, or just want to tell us something? This goes straight to the admin
        team — you don't need an account to send it.
      </p>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
        <ErrorBanner message={error} />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Name (optional)</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email (optional)</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="So we can get back to you, if needed"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
          <textarea
            rows={5}
            maxLength={2000}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-primary text-white py-2 text-sm font-medium hover:bg-primary-dark transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60"
        >
          {submitting ? (<span className="inline-flex items-center gap-1.5"><Loader2 size={14} className="animate-spin" />Sending…</span>) : 'Send feedback'}
        </button>
      </form>
    </div>
  )
}
