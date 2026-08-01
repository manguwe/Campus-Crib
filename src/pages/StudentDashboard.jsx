import { useAuth } from '../context/AuthContext'

export default function StudentDashboard() {
  const { profile } = useAuth()

  return (
    <div className="max-w-xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900">Student dashboard</h2>
      <p className="text-sm text-gray-500 mt-1">
        Logged in as {profile?.name} ({profile?.role})
      </p>
      <p className="text-sm text-gray-400 mt-4">
        Search, favourites, and reviews UI land here in the next build phase.
      </p>
    </div>
  )
}
