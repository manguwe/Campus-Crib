import { Link } from 'react-router-dom'
import { buildingTypeLabel, propertySummaryParts } from '../lib/propertyDisplay'

export default function PropertyCard({ property, thumbnailUrl }) {
  const summary = propertySummaryParts(property).join(' · ')
  const buildingLabel = buildingTypeLabel(property)

  return (
    <Link
      to={`/properties/${property.id}`}
      className="block bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
    >
      <div className="h-40 bg-gray-100">
        {thumbnailUrl ? (
          <img src={thumbnailUrl} alt={property.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300 text-sm">
            No photo yet
          </div>
        )}
      </div>

      <div className="p-4">
        {buildingLabel && (
          <span className="inline-block mb-1 text-xs font-medium text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">
            {buildingLabel}
          </span>
        )}
        <h3 className="font-medium text-gray-900 truncate">{property.title}</h3>
        <p className="text-sm text-gray-500 mt-0.5">{summary}</p>
        <p className="text-sm font-semibold text-gray-900 mt-2">
          {property.currency} {Number(property.price).toLocaleString()} / month
        </p>
      </div>
    </Link>
  )
}
