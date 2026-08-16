import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { SearchX } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import PropertyCard from '../components/PropertyCard'
import SearchFilters from '../components/SearchFilters'
import AiSearchBar from '../components/AiSearchBar'
import Select from '../components/ui/Select'
import { useFavourites } from '../hooks/useFavourites'
import { useCampuses } from '../context/CampusesContext'
import { distanceKm } from '../lib/distance'
import { groupRatingsByProperty } from '../lib/ratings'
import { formatSupabaseError } from '../lib/errorMessages'
import { logActivity } from '../lib/activityLog'
import { dashboardPathForRole } from '../lib/roleRoutes'
import PageLoading from '../components/ui/PageLoading'
import EmptyState from '../components/ui/EmptyState'
import ErrorBanner from '../components/ui/ErrorBanner'

const SORT_OPTIONS = [
  { value: 'distance', label: 'Distance (nearest first)' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'rating', label: 'Rating (highest first)' },
]

const baseFilters = {
  campusId: '', // filled in once campuses load, or from the ?campus= URL param below
  priceMin: '',
  priceMax: '',
  maxDistanceKm: '',
    buildingType: 'any',
  minOccupancy: '',
  toiletType: 'any',
  amenities: [],
  showOnlyAvailable: false,
}

// available < on_hold < taken, so a compound sort key of
// [availabilityRank, ...] keeps taken/on_hold listings from crowding
// out available ones at the top, regardless of the primary sort field.
const AVAILABILITY_RANK = { available: 0, on_hold: 1, taken: 2 }

export default function Browse() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { campuses, defaultCampusId, getCampusById, loading: campusesLoading } = useCampuses()
  const [searchParams, setSearchParams] = useSearchParams()

  // The Home page's search bar links here with ?campus=...&priceMax=...;
  // fold those into the starting filter state once on mount so the
  // search bar actually does something instead of just landing on the
  // default, unfiltered browse view.
  const initialFilters = useMemo(() => {
    const campusFromUrl = searchParams.get('campus')
    const priceMaxFromUrl = searchParams.get('priceMax')
    return {
      ...baseFilters,
      campusId: campusFromUrl || baseFilters.campusId,
      priceMax: priceMaxFromUrl || baseFilters.priceMax,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [sortBy, setSortBy] = useState(() => searchParams.get('sort') || 'distance')

  function handleSortChange(value) {
    setSortBy(value)
    const next = new URLSearchParams(searchParams)
    if (value === 'distance') next.delete('sort') // distance is the default, keep the URL clean
    else next.set('sort', value)
    setSearchParams(next, { replace: true })
  }

  const [properties, setProperties] = useState([])
  const [thumbnails, setThumbnails] = useState({}) // property_id -> url
  const [ratings, setRatings] = useState({}) // property_id -> {average, count}
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState(initialFilters)

  // Campuses load asynchronously now (admin-managed data, not a
  // hardcoded import) - fill in the default campus once they're in,
  // unless a ?campus= URL param already set one.
  useEffect(() => {
    if (!filters.campusId && defaultCampusId) {
      setFilters((prev) => ({ ...prev, campusId: defaultCampusId }))
    }
  }, [filters.campusId, defaultCampusId])

  const { favouriteIds, toggleFavourite } = useFavourites()

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError('')

      // No .eq('status', 'approved') needed - RLS already limits what an
      // anonymous/student visitor can see to approved rows (see
      // 02_policies.sql). Listing it explicitly here would just be
      // redundant, not the actual security boundary.
      const { data: props, error: propsError } = await supabase
        .from('properties')
        .select(
          'id, title, price, currency, building_type, occupancy, toilet_shared_by, walk_minutes_to_campus, primary_campus_id, amenities, latitude, longitude, availability_status, created_at'
        )
        .order('created_at', { ascending: false })

      if (propsError) {
        setError(formatSupabaseError(propsError, 'Could not load listings. Please try again.'))
        setLoading(false)
        return
      }

      setProperties(props)

      if (props.length > 0) {
        const { data: media } = await supabase
          .from('property_media')
          .select('property_id, url, sort_order, media_type')
          .in(
            'property_id',
            props.map((p) => p.id)
          )
          .eq('media_type', 'image')
          .order('sort_order', { ascending: true })

        const firstByProperty = {}
        for (const m of media || []) {
          if (!firstByProperty[m.property_id]) firstByProperty[m.property_id] = m.url
        }
        setThumbnails(firstByProperty)

        const { data: reviewRows } = await supabase
          .from('reviews')
          .select('property_id, rating')
          .in(
            'property_id',
            props.map((p) => p.id)
          )
        setRatings(groupRatingsByProperty(reviewRows))
      }

      setLoading(false)
    }

    load()
  }, [])

  const selectedCampus = getCampusById(filters.campusId)

  // Log 'search_performed' 800ms after the person stops changing
  // filters, rather than on every keystroke/checkbox toggle - skips the
  // very first run too, since that's just the default state loading,
  // not something the person actually did.
  const isFirstFilterRun = useRef(true)
  useEffect(() => {
    if (isFirstFilterRun.current) {
      isFirstFilterRun.current = false
      return
    }
    const timeout = setTimeout(() => {
      logActivity('search_performed', {
        details: {
          campus: filters.campusId,
          priceMin: filters.priceMin || null,
          priceMax: filters.priceMax || null,
          maxDistanceKm: filters.maxDistanceKm || null,
          buildingType: filters.buildingType,
          minOccupancy: filters.minOccupancy || null,
          toiletType: filters.toiletType,
          amenities: filters.amenities,
          showOnlyAvailable: filters.showOnlyAvailable,
        },
      })
    }, 800)
    return () => clearTimeout(timeout)
  }, [filters])

  // All filtering happens client-side after one fetch. Amenity containment
  // and distance both need the actual row data (jsonb array membership,
  // haversine against the chosen campus), so pushing this into the
  // Supabase query would mean several separate round trips for little
  // benefit at this dataset size - one fetch + array filtering is simpler
  // and fast enough for a single-campus-launch scale platform.
  const filtered = useMemo(() => {
    // selectedCampus is null while campuses are still loading, or if
    // filters.campusId hasn't been filled in yet - bail out to an empty
    // list rather than crashing on selectedCampus.latitude.
    if (!selectedCampus) return []

    const rows = properties
      .map((p) => ({
        ...p,
        distanceKm: distanceKm(selectedCampus.latitude, selectedCampus.longitude, p.latitude, p.longitude),
        ratingAverage: ratings[p.id]?.average ?? null,
      }))
      .filter((p) => {
        if (filters.priceMin && p.price < Number(filters.priceMin)) return false
        if (filters.priceMax && p.price > Number(filters.priceMax)) return false
        if (filters.buildingType !== 'any' && p.building_type !== filters.buildingType) return false
        if (filters.minOccupancy && (!p.occupancy || p.occupancy < Number(filters.minOccupancy))) return false
        if (filters.toiletType === 'private' && p.toilet_shared_by) return false
        if (filters.toiletType === 'shared' && !p.toilet_shared_by) return false
        if (filters.amenities.length > 0) {
          const propAmenities = p.amenities || []
          if (!filters.amenities.every((a) => propAmenities.includes(a))) return false
        }
        if (filters.maxDistanceKm) {
          if (p.distanceKm == null || p.distanceKm > Number(filters.maxDistanceKm)) return false
        }
        if (filters.showOnlyAvailable && p.availability_status !== 'available') return false
        return true
      })

    switch (sortBy) {
      case 'price_asc':
        return rows.sort((a, b) => a.price - b.price)
      case 'price_desc':
        return rows.sort((a, b) => b.price - a.price)
      case 'rating':
        // Unrated listings sort to the end regardless of direction, so a
        // handful of 5-star-but-unrated-looking rows don't crowd out
        // ones people have actually reviewed.
        return rows.sort((a, b) => (b.ratingAverage ?? -1) - (a.ratingAverage ?? -1))
      case 'distance':
      default:
        // Available listings before on_hold before taken, then by
        // distance within each group - so a taken room never crowds out
        // an available one at the top just for being closer.
        return rows.sort((a, b) => {
          const rankDiff = AVAILABILITY_RANK[a.availability_status] - AVAILABILITY_RANK[b.availability_status]
          if (rankDiff !== 0) return rankDiff
          return (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity)
        })
    }
  }, [properties, filters, selectedCampus, sortBy, ratings])

  // Browse is for students and guests - landlords manage their own
  // listings and have no reason to shop the marketplace the way a
  // student does. Guests and students pass straight through; only a
  // logged-in landlord gets redirected. Placed after every hook above,
  // same as the equivalent guard in Home.jsx.
  if (profile?.role === 'landlord') {
    return <Navigate to={dashboardPathForRole('landlord')} replace />
  }

  // Campuses are fetched once via CampusesContext - wait for that
  // before rendering anything that depends on selectedCampus, same
  // loading-gate pattern as the properties fetch itself.
  if (campusesLoading || !selectedCampus) {
    return <PageLoading label="Loading…" />
  }

  async function handleToggleFavourite(propertyId) {
    const result = await toggleFavourite(propertyId)
    if (result?.requiresLogin) {
      navigate('/login')
    }
  }

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-primary mb-1">Browse listings</h1>
      <p className="text-gray-500 mb-6">Approved boarding houses near {selectedCampus.name}.</p>

      <div className="mb-6">
        <AiSearchBar filters={filters} onChange={setFilters} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        <SearchFilters filters={filters} onChange={setFilters} />

        <div>
          {error && <ErrorBanner message={error} className="mb-4" />}

          {!loading && filtered.length > 0 && (
            <div className="flex items-center justify-end gap-2 mb-4">
              <label htmlFor="sort-by" className="text-sm text-gray-500 shrink-0">
                Sort by
              </label>
              <div className="w-56">
                <Select id="sort-by" value={sortBy} onChange={(e) => handleSortChange(e.target.value)}>
                  {SORT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          )}

          {loading ? (
            <PageLoading label="Loading listings…" />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title="No listings match those filters"
              description="Try widening your price range, increasing the distance, or clearing a few amenity filters."
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {filtered.map((p, i) => (
                <div
                  key={p.id}
                  className="animate-fade-in-up"
                  style={{ animationDelay: `${Math.min(i * 40, 240)}ms` }}
                >
                  <PropertyCard
                    property={p}
                    thumbnailUrl={thumbnails[p.id]}
                    distanceKm={p.distanceKm}
                    rating={ratings[p.id]}
                    isFavourited={favouriteIds.has(p.id)}
                    onToggleFavourite={handleToggleFavourite}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
