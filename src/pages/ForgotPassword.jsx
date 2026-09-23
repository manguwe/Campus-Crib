import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { formatSupabaseError } from '../lib/errorMessages'
import ErrorBanner from '../components/ui/ErrorBanner'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('Please enter a valid email address.')
      return
    }

    setSubmitting(true)
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setSubmitting(false)

    if (resetError) {
      setError(formatSupabaseError(resetError, 'Could not send the reset email. Please try again.'))
      return
    }

    // Always show the same confirmation regardless of whether the email
    // is actually registered, so this form can't be used to check which
    // emails have accounts.
    setSent(true)
  }

  if (sent) {
    return (
      <div className="max-w-md mx-auto bg-white rounded-2xl shadow-sm border border-gray-200 p-6 text-center">
        <h2 className="text-lg font-semibold text-primary mb-2">Check your email</h2>
        <p className="text-sm text-gray-600">
          If an account exists for <span className="font-medium">{email}</span>, a reset link has
          been sent. Click it to choose a new password.
        </p>
        <Link to="/login" className="inline-block mt-4 text-sm font-medium text-accent underline">
          Back to login
        </Link>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-md mx-auto bg-white rounded-2xl shadow-sm border border-gray-200 p-6"
    >
      <h2 className="text-lg font-semibold text-primary mb-1">Forgot your password?</h2>
      <p className="text-sm text-gray-500 mb-5">
        Enter the email on your account and we'll send you a link to reset it.
      </p>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        <ErrorBanner message={error} />

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-primary text-white py-2 text-sm font-medium hover:bg-primary-dark transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60"
        >
          {submitting ? 'Sending…' : 'Send reset link'}
        </button>
      </div>

      <p className="text-sm text-gray-500 mt-4 text-center">
        Remembered it?{' '}
        <Link to="/login" className="font-medium text-accent underline">
          Log in
        </Link>
      </p>
    </form>
  )
}
