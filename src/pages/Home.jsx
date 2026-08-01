import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Home() {
  const { session, profile } = useAuth()

  const dashboardPath =
    profile?.role === 'admin' ? '/admin' : profile?.role === 'landlord' ? '/landlord' : '/student'

  return (
    <div className="max-w-2xl mx-auto text-center">
      <h1 className="text-3xl font-bold text-gray-900">Find your next boarding house</h1>
      <p className="text-gray-500 mt-2">
        Verified listings near campus — search, compare, and contact landlords directly.
      </p>

      <div className="mt-6 flex items-center justify-center gap-3 flex-wrap">
        <Link
          to="/browse"
          className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50"
        >
          Browse listings
        </Link>
        {session ? (
          <Link
            to={dashboardPath}
            className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-700"
          >
            Go to your dashboard
          </Link>
        ) : (
          <>
            <Link
              to="/register/student"
              className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-700"
            >
              I'm a student
            </Link>
            <Link
              to="/register/landlord"
              className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50"
            >
              I'm a landlord
            </Link>
          </>
        )}
      </div>

      <p className="text-xs text-gray-400 mt-8">
        Listing search, maps, and filters land here in the next build phase.
      </p>
    </div>
  )
}
