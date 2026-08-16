import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function StudentDashboard() {
  const { profile } = useAuth()

  return (
    <div className="max-w-xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-primary">Student dashboard</h2>
      <p className="text-sm text-gray-500 mt-1">
        Logged in as {profile?.name} ({profile?.role})
      </p>

      <div className="flex gap-3 mt-4">
        <Link
          to="/browse"
          className="px-3 py-1.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark transition-all duration-150 hover:scale-[1.02] active:scale-[0.98]"
        >
          Browse listings
        </Link>
        <Link
          to="/favourites"
          className="px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors duration-150"
        >
          My favourites
        </Link>
      </div>
    </div>
  )
}
