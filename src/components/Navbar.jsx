import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Navbar() {
  const { session, profile, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/', { replace: true })
  }

  const dashboardPath =
    profile?.role === 'admin' ? '/admin' : profile?.role === 'landlord' ? '/landlord' : '/student'

  return (
    <nav className="w-full border-b border-gray-200 bg-white">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link to="/" className="font-semibold text-gray-900">
          Student Boarding House Finder
        </Link>

        <div className="flex items-center gap-4 text-sm">
          <Link to="/browse" className="text-gray-600 hover:text-gray-900">
            Browse
          </Link>

          {!session && (
            <>
              <Link to="/register/student" className="text-gray-600 hover:text-gray-900">
                Find a room
              </Link>
              <Link to="/register/landlord" className="text-gray-600 hover:text-gray-900">
                List a property
              </Link>
              <Link
                to="/login"
                className="px-3 py-1.5 rounded-lg bg-gray-900 text-white hover:bg-gray-700"
              >
                Log in
              </Link>
            </>
          )}

          {session && (
            <>
              <Link to={dashboardPath} className="text-gray-600 hover:text-gray-900">
                {profile?.name ? `Hi, ${profile.name.split(' ')[0]}` : 'Dashboard'}
              </Link>
              <button
                onClick={handleSignOut}
                className="px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Log out
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
