import { Link } from 'react-router-dom'
import { Heart, Navigation } from 'lucide-react'
import { buildingTypeLabel, propertySummaryParts } from '../lib/propertyDisplay'
import { formatDistanceKm } from '../lib/distance'
import { getAmenityIcon, getAmenityLabel } from '../lib/amenityIcons'
import { directionsUrl } from '../lib/googleMaps'
import { useCampuses } from '../context/CampusesContext'
import RatingSummary from './RatingSummary'
import AvailabilityStatusBadge from './AvailabilityStatusBadge'

export default function PropertyCard({
  property,
  thumbnailUrl,
  distanceKm,
  isFavourited = false,
  onToggleFavourite,
  rating,
}) {
  const { getCampusById } = useCampuses()
  const primaryCampusName = property.primary_campus_id
    ? getCampusById(property.primary_campus_id)?.name
    : null
  const summary = propertySummaryParts(property, primaryCampusName).join(' · ')
  const buildingLabel = buildingTypeLabel(property)
  const distanceLabel = formatDistanceKm(distanceKm)
  const amenities = property.amenities || []
  const shownAmenities = amenities.slice(0, 4)
  const extraCount = amenities.length - shownAmenities.length

  function handleHeartClick(e) {
    e.preventDefault()
    e.stopPropagation()
    onToggleFavourite?.(property.id)
  }

  function handleDirectionsClick(e) {
    // Card is wrapped in a Link - stop the click from also triggering
    // navigation to the detail page while still letting the anchor's
    // own href open Google Maps in a new tab.
    e.stopPropagation()
  }

  return (
    <Link
      to={`/properties/${property.id}`}
      className="group block bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all duration-150 relative"
    >
      <div className="h-40 bg-gray-100 relative overflow-hidden">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={property.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300 text-sm">
            No photo yet
          </div>
        )}

        {onToggleFavourite && (
          <button
            onClick={handleHeartClick}
            aria-label={isFavourited ? 'Remove from favourites' : 'Save to favourites'}
            className="absolute top-2 right-2 bg-white/90 rounded-full p-1.5 hover:bg-white shadow-sm"
          >
            <Heart
              size={18}
              className={isFavourited ? 'fill-red-500 text-red-500' : 'text-gray-500'}
            />
          </button>
        )}

        {property.availability_status && (
          <AvailabilityStatusBadge
            status={property.availability_status}
            className="absolute top-2 left-2 shadow-sm"
          />
        )}
      </div>

      <div className="p-4">
        <div className="flex items-center gap-2 flex-wrap mb-2">
          {buildingLabel && (
            <span className="text-xs font-medium text-primary bg-primary/10 rounded-full px-2.5 py-1">
              {buildingLabel}
            </span>
          )}
          {distanceLabel && (
            <span className="text-xs font-medium text-accent bg-accent/10 rounded-full px-2.5 py-1">
              {distanceLabel}
            </span>
          )}
          {property.latitude != null && property.longitude != null && (
            <a
              href={directionsUrl(property.latitude, property.longitude)}
              target="_blank"
              rel="noreferrer"
              onClick={handleDirectionsClick}
              className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700"
            >
              <Navigation size={11} />
              Get directions
            </a>
          )}
        </div>

        {/* Price is the primary visual anchor of the card - title and
            details are deliberately secondary/muted below it. */}
        <p className="text-lg font-bold text-primary leading-tight">
          {property.currency} {Number(property.price).toLocaleString()}
          <span className="text-xs font-normal text-gray-400"> / month</span>
        </p>
        <h3 className="text-sm font-medium text-gray-800 truncate mt-1">{property.title}</h3>
        <p className="text-xs text-gray-500 mt-1">{summary}</p>

        <div className="flex items-center justify-between mt-3">
          {shownAmenities.length > 0 ? (
            <div className="flex items-center gap-2 text-gray-400">
              {shownAmenities.map((value) => {
                const Icon = getAmenityIcon(value)
                return <Icon key={value} size={16} aria-label={getAmenityLabel(value)} />
              })}
              {extraCount > 0 && <span className="text-xs text-gray-400">+{extraCount}</span>}
            </div>
          ) : (
            <span />
          )}
          {rating && <RatingSummary average={rating.average} count={rating.count} />}
        </div>
      </div>
    </Link>
  )
}
