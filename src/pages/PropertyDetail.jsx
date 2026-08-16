import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Heart, ArrowLeft, Expand } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { buildingTypeLabel, propertySummaryParts } from '../lib/propertyDisplay'
import { getAmenityIcon, getAmenityLabel } from '../lib/amenityIcons'
import { useFavourites } from '../hooks/useFavourites'
import { useCampuses } from '../context/CampusesContext'
import GoogleMapPin from '../components/GoogleMapPin'
import DirectionsPanel from '../components/DirectionsPanel'
import ContactLandlordButton from '../components/ContactLandlordButton'
import ReviewsSection from '../components/ReviewsSection'
import RatingSummary from '../components/RatingSummary'
import AvailabilityStatusBadge from '../components/AvailabilityStatusBadge'
import ReportListingButton from '../components/ReportListingButton'
import Lightbox from '../components/Lightbox'
import PageLoading from '../components/ui/PageLoading'

export default function PropertyDetail() {
  const { id } = useParams()
  const { user, role } = useAuth()
  const { getCampusById } = useCampuses()
  const [lightboxIndex, setLightboxIndex] = useState(null)
  const [property, setProperty] = useState(null)
  const [media, setMedia] = useState([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [rating, setRating] = useState(null)

  const { favouriteIds, toggleFavourite } = useFavourites()

  useEffect(() => {
    async function load() {
      setLoading(true)
      // RLS returns this row only if it's approved, or the caller owns it
      // / is an admin - a pending listing's id just comes back empty for
      // anyone else, same as a bad id would.
      const { data, error } = await supabase.from('properties').select('*').eq('id', id).single()

      if (error || !data) {
        setNotFound(true)
        setLoading(false)
        return
      }

      setProperty(data)

      const { data: mediaRows } = await supabase
        .from('property_media')
        .select('id, media_type, url, sort_order')
        .eq('property_id', id)
        .order('sort_order', { ascending: true })

      setMedia(mediaRows || [])
      setLoading(false)
    }

    load()
  }, [id])

  if (loading) return <PageLoading label="Loading listing…" />

  if (notFound) {
    return (
      <div className="max-w-lg mx-auto text-center">
        <p className="text-gray-600">That listing doesn't exist, or isn't published yet.</p>
        <Link
          to="/browse"
          className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-full border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors duration-150"
        >
          <ArrowLeft size={14} />
          Back to listings
        </Link>
      </div>
    )
  }

  const primaryCampusName = property.primary_campus_id ? getCampusById(property.primary_campus_id)?.name : null
  const summary = propertySummaryParts(property, primaryCampusName).join(' · ')
  const buildingLabel = buildingTypeLabel(property)
  // Custom (free-text) amenities live in the same array as the preset
  // checklist values - anything not matching a known AMENITY_OPTIONS
  // value is still shown, just using its own text as the label.
  const selectedAmenities = (property.amenities || []).map((value) => ({
    value,
    label: getAmenityLabel(value),
  }))
  const isFavourited = favouriteIds.has(property.id)

  const AVAILABILITY_NOTES = {
    on_hold: 'This room is currently on hold for another student, but you can still ask the landlord about it.',
    taken: 'This room is no longer available.',
  }
  const availabilityNote = AVAILABILITY_NOTES[property.availability_status]

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <Link
          to="/browse"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors duration-150 hover:border-gray-300 transition-colors"
        >
          <ArrowLeft size={14} />
          Back to listings
        </Link>
      </div>

      {media.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {media.map((m, i) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setLightboxIndex(i)}
              className="group rounded-xl overflow-hidden border border-gray-200 relative"
            >
              {m.media_type === 'video' ? (
                <video src={m.url} className="w-full h-40 object-cover pointer-events-none" />
              ) : (
                <img src={m.url} alt={property.title} className="w-full h-40 object-cover" />
              )}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                <Expand
                  size={20}
                  className="text-white opacity-0 group-hover:opacity-100 transition-opacity"
                />
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 py-8 text-center text-sm text-gray-400">
          No photos uploaded for this listing yet.
        </div>
      )}

      {lightboxIndex !== null && (
        <Lightbox items={media} initialIndex={lightboxIndex} onClose={() => setLightboxIndex(null)} />
      )}

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            {buildingLabel && (
              <span className="inline-block mb-2 text-xs font-medium text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">
                {buildingLabel}
              </span>
            )}
            {property.availability_status && (
              <AvailabilityStatusBadge status={property.availability_status} className="inline-block mb-2 ml-1" />
            )}
            <h1 className="text-2xl font-bold text-primary">{property.title}</h1>
            <p className="text-gray-500 mt-1">{summary}</p>
            {rating && (
              <div className="mt-1">
                <RatingSummary average={rating.average} count={rating.count} />
              </div>
            )}
          </div>

          <button
            onClick={() => toggleFavourite(property.id)}
            aria-label={isFavourited ? 'Remove from favourites' : 'Save to favourites'}
            className="shrink-0 bg-gray-50 rounded-full p-2.5 hover:bg-gray-100 border border-gray-200"
          >
            <Heart size={20} className={isFavourited ? 'fill-red-500 text-red-500' : 'text-gray-500'} />
          </button>
        </div>

        <p className="text-lg font-semibold text-gray-900 mt-3">
          {property.currency} {Number(property.price).toLocaleString()} / month
        </p>

        {property.address_text && (
          <p className="text-sm text-gray-600 mt-3">📍 {property.address_text}</p>
        )}

        {property.description && (
          <p className="text-sm text-gray-700 mt-4 whitespace-pre-line">{property.description}</p>
        )}

        {selectedAmenities.length > 0 && (
          <div className="mt-5">
            <h2 className="text-sm font-medium text-primary mb-2">Amenities</h2>
            <div className="flex flex-wrap gap-3">
              {selectedAmenities.map((a) => {
                const Icon = getAmenityIcon(a.value)
                return (
                  <span
                    key={a.value}
                    className="flex items-center gap-1.5 text-xs text-gray-600 bg-gray-100 rounded-full px-2.5 py-1"
                  >
                    <Icon size={14} />
                    {a.label}
                  </span>
                )
              })}
            </div>
          </div>
        )}

        <div className="mt-5">
          <h2 className="text-sm font-medium text-primary mb-2">Contact</h2>
          {availabilityNote && (
            <p
              className={`text-xs rounded-lg px-3 py-2 mb-3 ${
                property.availability_status === 'taken'
                  ? 'text-red-700 bg-red-50 border border-red-200'
                  : 'text-amber-700 bg-amber-50 border border-amber-200'
              }`}
            >
              {availabilityNote}
            </p>
          )}
          <ContactLandlordButton propertyId={property.id} landlordId={property.landlord_id} />

          {/* Only a logged-in student, viewing a listing that isn't
              their own, can report it - not guests, not the landlord
              themselves, not admins. */}
          {role === 'student' && user && user.id !== property.landlord_id && (
            <div className="mt-3">
              <ReportListingButton propertyId={property.id} userId={user.id} />
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <h2 className="text-sm font-medium text-primary mb-3">Location</h2>
        <GoogleMapPin latitude={property.latitude} longitude={property.longitude} title={property.title} />
        {property.latitude != null && property.longitude != null && (
          <DirectionsPanel
            destination={{ lat: Number(property.latitude), lng: Number(property.longitude) }}
          />
        )}
      </div>

      <ReviewsSection propertyId={property.id} onSummaryChange={setRating} />
    </div>
  )
}
