import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { formatSupabaseError } from '../lib/errorMessages'
import ErrorBanner from '../components/ui/ErrorBanner'
import PageLoading from '../components/ui/PageLoading'

export default function ResetPassword() {
  // Supabase's client library detects the recovery token in the URL on
  // page load and exchanges it for a real session automatically (see
  // supabaseClient.js - detectSessionInUrl is on by default), which
  // AuthContext then picks up via onAuthStateChange like any other
  // session. So by the time `loading` is false here, `session` tells us
  // whether the link was valid.
  const { session, loading } = useAuth()
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setSubmitting(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setSubmitting(false)

    if (updateError) {
      setError(formatSupabaseError(updateError, 'Could not update your password. Please try again.'))
      return
    }

    setDone(true)
  }

  if (loading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <PageLoading label="Loading…" />
      </div>
    )
  }

  if (done) {
    return (
      <div className="max-w-md mx-auto bg-white rounded-2xl shadow-sm border border-gray-200 p-6 text-center">
        <h2 className="text-lg font-semibold text-primary mb-2">Password updated</h2>
        <p className="text-sm text-gray-600">You can now log in with your new password.</p>
        <button
          onClick={() => navigate('/login', { replace: true })}
          className="inline-block mt-4 rounded-lg bg-primary text-white px-4 py-2 text-sm font-medium hover:bg-primary-dark transition-colors duration-150"
        >
          Go to login
        </button>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="max-w-md mx-auto bg-white rounded-2xl shadow-sm border border-gray-200 p-6 text-center">
        <h2 className="text-lg font-semibold text-primary mb-2">Link invalid or expired</h2>
        <p className="text-sm text-gray-600">
          This password reset link isn't valid anymore. Request a new one and try again.
        </p>
        <Link
          to="/forgot-password"
          className="inline-block mt-4 text-sm font-medium text-accent underline"
        >
          Request a new link
        </Link>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-md mx-auto bg-white rounded-2xl shadow-sm border border-gray-200 p-6"
    >
      <h2 className="text-lg font-semibold text-primary mb-1">Choose a new password</h2>
      <p className="text-sm text-gray-500 mb-5">Enter and confirm your new password below.</p>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            placeholder="At least 6 characters"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Confirm new password</label>
          <input
            type="password"
            required
            minLength={6}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        <ErrorBanner message={error} />

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-primary text-white py-2 text-sm font-medium hover:bg-primary-dark transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60"
        >
          {submitting ? 'Updating…' : 'Update password'}
        </button>
      </div>
    </form>
  )
}
