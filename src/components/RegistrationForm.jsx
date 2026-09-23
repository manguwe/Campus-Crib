import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { formatSupabaseError } from '../lib/errorMessages'
import ErrorBanner from './ui/ErrorBanner'

export default function RegistrationForm({ role, title, roleLabel, afterPath }) {
  const { signUp } = useAuth()
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [confirmationPending, setConfirmationPending] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (name.trim().length < 2) {
      setError('Please enter your full name.')
      return
    }

    if (phone && !/^[+\d][\d\s-]{6,}$/.test(phone.trim())) {
      setError('Please enter a valid phone number (digits only, optionally starting with +).')
      return
    }

    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('Please enter a valid email address.')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    if (!termsAccepted) {
      setError('You must agree to the Terms of Service and Privacy Notice to create an account.')
      return
    }

    setSubmitting(true)
    const { data, error: signUpError } = await signUp({
      email: email.trim().toLowerCase(),
      password,
      name: name.trim(),
      role,
      phone: phone.trim(),
      termsAcceptedAt: new Date().toISOString(),
    })
    setSubmitting(false)

    if (signUpError) {
      setError(formatSupabaseError(signUpError, 'Could not create your account. Please try again.'))
      return
    }

    if (data?.session) {
      // Email confirmation is disabled in this project's Auth settings,
      // so signUp() already returned a live session - go straight in.
      navigate(afterPath, { replace: true })
    } else {
      // Email confirmation is required. There's no session yet, so route
      // protection would just bounce them back to /login anyway - show a
      // clear "check your inbox" message instead.
      setConfirmationPending(true)
    }
  }

  if (confirmationPending) {
    return (
      <div className="max-w-md mx-auto bg-white rounded-2xl shadow-sm border border-gray-200 p-6 text-center">
        <h2 className="text-lg font-semibold text-primary mb-2">Check your email</h2>
        <p className="text-sm text-gray-600">
          We sent a confirmation link to <span className="font-medium">{email}</span>. Click it,
          then come back and log in.
        </p>
        <Link to="/login" className="inline-block mt-4 text-sm font-medium text-accent underline">
          Go to login
        </Link>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-md mx-auto bg-white rounded-2xl shadow-sm border border-gray-200 p-6"
    >
      <h2 className="text-lg font-semibold text-primary mb-1">{title}</h2>
      <p className="text-sm text-gray-500 mb-5">Registering as a {roleLabel.toLowerCase()}.</p>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Full name</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            placeholder="e.g. Natasha Phiri"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Phone number</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            placeholder="e.g. 0977123456"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
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

        <label className="flex items-start gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={termsAccepted}
            onChange={(e) => setTermsAccepted(e.target.checked)}
            className="mt-0.5 rounded border-gray-300 text-accent focus:ring-accent"
          />
          <span>
            I agree to the{' '}
            <Link
              to="/terms"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-accent underline"
            >
              Terms of Service and Privacy Notice
            </Link>
          </span>
        </label>

        <ErrorBanner message={error} />

        <button
          type="submit"
          disabled={submitting || !termsAccepted}
          className="w-full rounded-lg bg-primary text-white py-2 text-sm font-medium hover:bg-primary-dark transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60"
        >
          {submitting ? 'Creating account…' : `Register as ${roleLabel}`}
        </button>
      </div>

      <p className="text-sm text-gray-500 mt-4 text-center">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-accent underline">
          Log in
        </Link>
      </p>
    </form>
  )
}
