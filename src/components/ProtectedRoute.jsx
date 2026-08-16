import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { dashboardPathForRole } from '../lib/roleRoutes'
import PageLoading from './ui/PageLoading'

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
      <div className="min-h-screen flex items-center justify-center">
        <PageLoading label="Loading…" />
      </div>
    )
  }

  if (!session) {
    // Not logged in at all - send to login, remembering where they were
    // headed so we can bounce them back after a successful sign-in.
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (profile?.is_suspended) {
    // Blocks meaningful use of the app while suspended - explains why on
    // its own page rather than silently failing or letting them through.
    return <Navigate to="/suspended" replace />
  }

  if (allowedRoles && (!profile || !allowedRoles.includes(profile.role))) {
    // Logged in, but the wrong role for this route (e.g. a student trying
    // to reach /landlord). Send them straight to their own dashboard
    // instead of an interstitial "not allowed" page - no extra click
    // required. dashboardPathForRole returns null for a missing/unknown
    // role (e.g. profile hasn't loaded a role yet), so fall back to
    // /unauthorized in that edge case rather than redirecting to null.
    return <Navigate to={dashboardPathForRole(profile?.role) || '/unauthorized'} replace />
  }

  return children
}
