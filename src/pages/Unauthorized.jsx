import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Unauthorized() {
  const { profile } = useAuth()

  const dashboardPath =
    profile?.role === 'admin' ? '/admin' : profile?.role === 'landlord' ? '/landlord' : '/student'

  return (
    <div className="max-w-md mx-auto bg-white rounded-2xl shadow-sm border border-gray-200 p-6 text-center">
      <h2 className="text-lg font-semibold text-gray-900">Not authorised</h2>
      <p className="text-sm text-gray-500 mt-2">
        Your account ({profile?.role || 'unknown role'}) doesn't have access to that page.
      </p>
      <Link
        to={dashboardPath}
        className="inline-block mt-4 text-sm font-medium text-gray-900 underline"
      >
        Go to your dashboard
      </Link>
    </div>
  )
}
