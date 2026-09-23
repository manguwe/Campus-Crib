import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { usePlatformMode } from '../context/PlatformModeContext'
import PageLoading from './ui/PageLoading'

const PUBLIC_MARKETPLACE_PATHS = ['/browse', '/properties/']
const ALLOWED_DURING_MAINTENANCE = ['/maintenance', '/login', '/forgot-password', '/reset-password', '/register/student', '/register/landlord', '/debug', '/terms']

export default function PlatformModeGate({ children }) {
  const { mode, loading } = usePlatformMode()
  const { profile } = useAuth()
  const location = useLocation()

  if (loading) return <PageLoading label="Loading Campus Crib…" />

  const isAllowedDuringMaintenance = ALLOWED_DURING_MAINTENANCE.some((path) => location.pathname === path || location.pathname.startsWith(`${path}/`))
  const isMarketplacePath = PUBLIC_MARKETPLACE_PATHS.some((path) => location.pathname === path || location.pathname.startsWith(path))

  if (mode === 'maintenance' && !isAllowedDuringMaintenance && profile?.role !== 'admin') {
    return <Navigate to="/maintenance" replace state={{ from: location.pathname }} />
  }

  if (mode === 'pre_launch' && isMarketplacePath && profile?.role !== 'admin') {
    return <Navigate to="/" replace />
  }

  return children
}
