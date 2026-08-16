import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { dashboardPathForRole } from '../lib/roleRoutes'
import NotificationBell from './NotificationBell'
import logoIcon from '../assets/logo-icon.png'

export default function Navbar() {
  const { session, profile, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  async function handleSignOut() {
    setMenuOpen(false)
    await signOut()
    navigate('/', { replace: true })
  }

  function closeMenu() {
    setMenuOpen(false)
  }

  function isActive(path) {
    return location.pathname === path
  }

  // Underline grows in from the center on hover/active, rather than
  // popping in instantly - a small but real bit of motion on the nav.
  function navLinkClass(path) {
    return `relative text-gray-600 hover:text-primary transition-colors duration-150 pb-0.5
      after:content-[''] after:absolute after:left-0 after:right-0 after:-bottom-0.5 after:h-0.5
      after:bg-primary after:rounded-full after:origin-center after:transition-transform after:duration-200
      ${isActive(path) ? 'text-primary after:scale-x-100' : 'after:scale-x-0 hover:after:scale-x-100'}`
  }

  const dashboardPath = dashboardPathForRole(profile?.role) || '/'

  // Landlords manage their own listings and have no reason to browse the
  // marketplace the way a student does - hidden for landlords, visible
  // for guests, students, and admins.
  const showBrowseLink = profile?.role !== 'landlord'

  return (
    <nav className="w-full border-b border-gray-200 bg-white sticky top-0 z-30">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
        <Link to="/" onClick={closeMenu} className="shrink-0 flex items-center gap-2">
          <img src={logoIcon} alt="" className="h-9 w-auto" />
          <span className="font-semibold text-primary text-lg tracking-tight">Campus Crib</span>
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-4 text-sm">
          {showBrowseLink && (
            <Link to="/browse" className={navLinkClass('/browse')}>
              Browse
            </Link>
          )}

          {!session && (
            <>
              <Link to="/register/student" className={navLinkClass('/register/student')}>
                Find a room
              </Link>
              <Link to="/register/landlord" className={navLinkClass('/register/landlord')}>
                List a property
              </Link>
              <Link
                to="/login"
                className="px-3 py-1.5 rounded-lg bg-primary text-white hover:bg-primary-dark transition-all duration-150 hover:scale-[1.02] active:scale-[0.98]"
              >
                Log in
              </Link>
            </>
          )}

          {session && (
            <>
              <NotificationBell />
              {profile?.role === 'student' && (
                <Link to="/favourites" className={navLinkClass('/favourites')}>
                  Favourites
                </Link>
              )}
              <Link to={dashboardPath} className={navLinkClass(dashboardPath)}>
                {profile?.name ? `Hi, ${profile.name.split(' ')[0]}` : 'Dashboard'}
              </Link>
              <button
                onClick={handleSignOut}
                className="px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors duration-150"
              >
                Log out
              </button>
            </>
          )}
        </div>

        {/* Mobile: bell (if logged in) + hamburger toggle */}
        <div className="flex md:hidden items-center gap-2">
          {session && <NotificationBell />}
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            className="p-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors duration-150"
          >
            <span className="relative block w-[22px] h-[22px]">
              <Menu
                size={22}
                className={`absolute inset-0 transition-all duration-200 ${menuOpen ? 'opacity-0 rotate-90 scale-75' : 'opacity-100 rotate-0 scale-100'}`}
              />
              <X
                size={22}
                className={`absolute inset-0 transition-all duration-200 ${menuOpen ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-75'}`}
              />
            </span>
          </button>
        </div>
      </div>

      {/* Mobile dropdown panel - always mounted, height/opacity animated so
          it slides/fades open instead of popping in instantly. */}
      <div
        className={`md:hidden overflow-hidden transition-all duration-200 ease-in-out ${
          menuOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="border-t border-gray-200 px-4 py-3 flex flex-col gap-1 text-sm bg-white">
          {showBrowseLink && (
            <Link
              to="/browse"
              onClick={closeMenu}
              className={`py-2 transition-colors duration-150 ${isActive('/browse') ? 'text-primary font-medium' : 'text-gray-700'}`}
            >
              Browse
            </Link>
          )}

          {!session && (
            <>
              <Link
                to="/register/student"
                onClick={closeMenu}
                className={`py-2 transition-colors duration-150 ${isActive('/register/student') ? 'text-primary font-medium' : 'text-gray-700'}`}
              >
                Find a room
              </Link>
              <Link
                to="/register/landlord"
                onClick={closeMenu}
                className={`py-2 transition-colors duration-150 ${isActive('/register/landlord') ? 'text-primary font-medium' : 'text-gray-700'}`}
              >
                List a property
              </Link>
              <Link
                to="/login"
                onClick={closeMenu}
                className="mt-1 px-3 py-2 rounded-lg bg-primary text-white text-center font-medium hover:bg-primary-dark transition-colors duration-150"
              >
                Log in
              </Link>
            </>
          )}

          {session && (
            <>
              {profile?.role === 'student' && (
                <Link
                  to="/favourites"
                  onClick={closeMenu}
                  className={`py-2 transition-colors duration-150 ${isActive('/favourites') ? 'text-primary font-medium' : 'text-gray-700'}`}
                >
                  Favourites
                </Link>
              )}
              <Link
                to={dashboardPath}
                onClick={closeMenu}
                className={`py-2 transition-colors duration-150 ${isActive(dashboardPath) ? 'text-primary font-medium' : 'text-gray-700'}`}
              >
                {profile?.name ? `Hi, ${profile.name.split(' ')[0]}` : 'Dashboard'}
              </Link>
              <button
                onClick={handleSignOut}
                className="mt-1 px-3 py-2 rounded-lg border border-gray-300 text-gray-700 text-center hover:bg-gray-50 transition-colors duration-150"
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
