import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/**
 * Wrap any route element that requires a logged-in user, optionally
 * restricted to specific roles.
 *
 *   <ProtectedRoute allowedRoles={['landlord']}>
 *     <LandlordDashboard />
 *   </ProtectedRoute>
 */
export default function ProtectedRoute({ allowedRoles, children }) {
  const { session, profile, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Loading…
      </div>
    )
  }

  if (!session) {
    // Not logged in at all - send to login, remembering where they were
    // headed so we can bounce them back after a successful sign-in.
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (allowedRoles && (!profile || !allowedRoles.includes(profile.role))) {
    // Logged in, but the wrong role for this route (e.g. a student trying
    // to reach /landlord). Send to a dedicated "not allowed" page rather
    // than silently redirecting to their own dashboard, so it's obvious
    // what happened instead of looking like a broken link.
    return <Navigate to="/unauthorized" replace />
  }

  return children
}
