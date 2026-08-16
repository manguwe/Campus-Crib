import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Search, ShieldCheck, MapPin, Star, Home as HomeIcon, Quote } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { useCampuses } from '../context/CampusesContext'
import { dashboardPathForRole } from '../lib/roleRoutes'

export default function Home() {
  const { session, profile, loading } = useAuth()
  const { campuses, defaultCampusId } = useCampuses()
  const navigate = useNavigate()

  const [campusId, setCampusId] = useState('')
  const [priceMax, setPriceMax] = useState('')
  const [testimonials, setTestimonials] = useState([])

  // Campuses load asynchronously now (they're admin-managed data, not a
  // hardcoded import) - default the search bar to the first one once
  // they're in, without forcing a loading state on the whole hero.
  useEffect(() => {
    if (!campusId && defaultCampusId) setCampusId(defaultCampusId)
  }, [campusId, defaultCampusId])

  useEffect(() => {
    let cancelled = false

    async function loadTestimonials() {
      const { data, error } = await supabase
        .from('feedback')
        .select('id, name, message, created_at')
        .eq('show_as_testimonial', true)
        .order('created_at', { ascending: false })
        .limit(6)

      if (!cancelled && !error && data) setTestimonials(data)
    }

    loadTestimonials()
    return () => {
      cancelled = true
    }
  }, [])

  // The landing page (testimonials, "for landlords" CTA, etc.) is for
  // logged-out visitors only - anyone already authenticated should never
  // land here, whether that's right after login (handled directly in
  // Login.jsx) or by navigating back to "/" some other way (typing the
  // URL, clicking the logo, browser back button). Gated on `loading` so
  // this doesn't fire on a stale/not-yet-resolved profile during the
  // initial auth check. Placed after all hooks above, per the Rules of
  // Hooks - an early return can't sit between two hook calls.
  if (session && !loading) {
    const dashboardPath = dashboardPathForRole(profile?.role)
    if (dashboardPath) return <Navigate to={dashboardPath} replace />
  }

  function handleSearch(e) {
    e.preventDefault()
    const params = new URLSearchParams()
    if (campusId) params.set('campus', campusId)
    if (priceMax) params.set('priceMax', priceMax)
    navigate(`/browse?${params.toString()}`)
  }

  return (
    <div className="space-y-16">
      {/* Hero */}
      <section className="text-center max-w-2xl mx-auto pt-4 animate-fade-in-up">
        <span className="inline-block text-xs font-medium text-gray-500 bg-gray-100 rounded-full px-3 py-1 mb-4">
          Verified listings near your campus
        </span>
        <h1 className="text-3xl sm:text-4xl font-bold text-primary leading-tight">
          Find your next boarding house, without the guesswork
        </h1>
        <p className="text-accent font-medium mt-2">Find your perfect student home.</p>
        <p className="text-gray-500 mt-3">
          Search verified boarding houses near UNZA and Eden University, compare prices and
          amenities, and contact landlords directly — no more scrolling through WhatsApp groups.
        </p>

        {/* Search bar */}
        <form
          onSubmit={handleSearch}
          className="mt-8 bg-white rounded-2xl border border-gray-200 shadow-sm p-3 sm:p-2 flex flex-col sm:flex-row gap-2 text-left"
        >
          <div className="flex-1 sm:min-w-[220px]">
            <label className="sr-only">Campus</label>
            <select
              value={campusId}
              onChange={(e) => setCampusId(e.target.value)}
              className="w-full h-full rounded-lg border border-gray-200 sm:border-0 px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-accent"
            >
              {campuses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:w-36">
            <label className="sr-only">Max price</label>
            <input
              type="number"
              min="0"
              placeholder="Max price (ZMW)"
              value={priceMax}
              onChange={(e) => setPriceMax(e.target.value)}
              className="w-full rounded-lg border border-gray-200 sm:border-0 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <button
            type="submit"
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark transition-all duration-150 hover:scale-[1.02] active:scale-[0.98]"
          >
            <Search size={16} />
            Search
          </button>
        </form>

        <div className="mt-6 flex items-center justify-center gap-3 flex-wrap">
          <Link
            to="/register/student"
            className="px-5 py-2.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark transition-all duration-150 hover:scale-[1.02] active:scale-[0.98]"
          >
            Register as a student
          </Link>
          <Link
            to="/register/landlord"
            className="px-5 py-2.5 rounded-lg border-2 border-accent text-accent text-sm font-medium hover:bg-accent hover:text-white transition-colors"
          >
            Register as a landlord
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section className="animate-fade-in-up" style={{ animationDelay: '80ms' }}>
        <h2 className="text-center text-xl font-semibold text-primary mb-8">How it works</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {[
            {
              icon: Search,
              title: 'Search & filter',
              text: 'Filter by campus, price, room type, amenities and distance to find places that actually fit.',
            },
            {
              icon: ShieldCheck,
              title: 'Verified landlords',
              text: 'Every landlord is ID-verified by an admin before their listings go live, cutting down on scams.',
            },
            {
              icon: MapPin,
              title: 'Contact directly',
              text: 'See the exact location on a map, then call or text the landlord straight from the listing.',
            },
          ].map((item) => (
            <div key={item.title} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 text-center">
              <div className="inline-flex bg-gray-100 rounded-full p-3 mb-3">
                <item.icon size={20} className="text-gray-700" />
              </div>
              <p className="font-medium text-gray-900">{item.title}</p>
              <p className="text-sm text-gray-500 mt-1">{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Landlord CTA */}
      <section className="bg-primary rounded-2xl px-6 py-10 sm:px-10 text-center sm:text-left sm:flex sm:items-center sm:justify-between gap-6 animate-fade-in-up" style={{ animationDelay: '120ms' }}>
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">For landlords</p>
          <h2 className="text-xl sm:text-2xl font-semibold text-white">
            List your boarding house to genuine student tenants
          </h2>
          <p className="text-gray-300 text-sm mt-2 max-w-lg">
            Register, verify your ID once, and reach students searching specifically for
            accommodation near their campus — free to list.
          </p>
        </div>
        <Link
          to="/register/landlord"
          className="mt-6 sm:mt-0 shrink-0 inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-white text-gray-900 text-sm font-semibold hover:bg-gray-100"
        >
          <HomeIcon size={16} />
          List your property
        </Link>
      </section>

      {testimonials.length > 0 && (
        <section className="animate-fade-in-up">
          <h2 className="text-center text-xl font-semibold text-primary mb-8">
            What people are saying
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-5xl mx-auto">
            {testimonials.map((t) => (
              <div key={t.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                <Quote size={18} className="text-accent/50 mb-2" />
                <p className="text-sm text-gray-700 leading-relaxed">{t.message}</p>
                <p className="text-xs font-medium text-gray-400 mt-3">— {t.name || 'Anonymous'}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Trust strip */}
      <section className="max-w-2xl mx-auto text-center">
        <div className="flex items-center justify-center gap-1.5 text-sm text-gray-500">
          <Star size={14} className="fill-yellow-400 text-yellow-400" />
          Rated by real students who've stayed there
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Starting at UNZA and Eden University — more campuses on the way.
        </p>
      </section>
    </div>
  )
}
