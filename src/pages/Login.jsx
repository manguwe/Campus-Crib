import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { formatSupabaseError } from '../lib/errorMessages'
import { dashboardPathForRole } from '../lib/roleRoutes'
import ErrorBanner from '../components/ui/ErrorBanner'

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('Please enter a valid email address.')
      return
    }

    setSubmitting(true)

    const { error: signInError, role } = await signIn({ email: email.trim().toLowerCase(), password })

    setSubmitting(false)

    if (signInError) {
      setError(formatSupabaseError(signInError, 'Could not log in. Please try again.'))
      return
    }

    // Prefer sending them back to wherever ProtectedRoute intercepted them
    // from; otherwise fall back to a role-appropriate dashboard.
    const from = location.state?.from?.pathname
    navigate(from || dashboardPathForRole(role) || '/', { replace: true })
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-md mx-auto bg-white rounded-2xl shadow-sm border border-gray-200 p-6"
    >
      <h2 className="text-lg font-semibold text-primary mb-5">Log in</h2>

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

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium text-gray-700">Password</label>
            <Link to="/forgot-password" className="text-xs font-medium text-accent underline">
              Forgot password?
            </Link>
          </div>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        <ErrorBanner message={error} />

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-primary text-white py-2 text-sm font-medium hover:bg-primary-dark transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60"
        >
          {submitting ? 'Logging in…' : 'Log in'}
        </button>
      </div>

      <p className="text-sm text-gray-500 mt-4 text-center">
        New here?{' '}
        <Link to="/register/student" className="font-medium text-accent underline">
          Register as a student
        </Link>{' '}
        or{' '}
        <Link to="/register/landlord" className="font-medium text-accent underline">
          as a landlord
        </Link>
      </p>
    </form>
  )
}
