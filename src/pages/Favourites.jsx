import { useEffect, useState } from 'react'
import { Heart } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import PropertyCard from '../components/PropertyCard'
import { useFavourites } from '../hooks/useFavourites'
import { groupRatingsByProperty } from '../lib/ratings'
import { formatSupabaseError } from '../lib/errorMessages'
import PageLoading from '../components/ui/PageLoading'
import EmptyState from '../components/ui/EmptyState'
import ErrorBanner from '../components/ui/ErrorBanner'

export default function Favourites() {
  const { user } = useAuth()
  const [properties, setProperties] = useState([])
  const [thumbnails, setThumbnails] = useState({})
  const [ratings, setRatings] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const { favouriteIds, toggleFavourite, refresh } = useFavourites()

  async function loadFavourites() {
    setLoading(true)
    setError('')

    // Embeds the related property row directly via the favourites ->
    // properties foreign key. RLS on favourites already limits this to
    // the current student's own rows.
    const { data, error } = await supabase
      .from('favourites')
      .select(
        'property_id, properties(id, title, price, currency, building_type, occupancy, toilet_shared_by, walk_minutes_to_campus, primary_campus_id, amenities, availability_status, latitude, longitude)'
      )
      .eq('student_id', user.id)

    if (error) {
      setError(formatSupabaseError(error, 'Could not load your favourites. Please try again.'))
      setLoading(false)
      return
    }

    const props = (data || []).map((row) => row.properties).filter(Boolean)
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

  useEffect(() => {
    if (user?.id) loadFavourites()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  async function handleToggleFavourite(propertyId) {
    await toggleFavourite(propertyId)
    // Removing a favourite here should drop it from this page immediately.
    setProperties((prev) => prev.filter((p) => p.id !== propertyId))
    refresh()
  }

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-primary mb-1">My favourites</h1>
      <p className="text-gray-500 mb-6">Properties you've saved.</p>

      {error && <ErrorBanner message={error} className="mb-4" />}

      {loading ? (
        <PageLoading label="Loading your favourites…" />
      ) : properties.length === 0 ? (
        <EmptyState
          icon={Heart}
          title="No saved listings yet"
          description="Browse properties and tap the heart icon to save one here for later."
          action={{ label: 'Browse listings', to: '/browse' }}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {properties.map((p, i) => (
            <div
              key={p.id}
              className="animate-fade-in-up"
              style={{ animationDelay: `${Math.min(i * 40, 240)}ms` }}
            >
              <PropertyCard
                property={p}
                thumbnailUrl={thumbnails[p.id]}
                isFavourited={favouriteIds.has(p.id)}
                onToggleFavourite={handleToggleFavourite}
                rating={ratings[p.id]}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
