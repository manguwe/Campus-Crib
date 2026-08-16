import { useState } from 'react'
import { SlidersHorizontal, ChevronDown, ChevronUp } from 'lucide-react'
import { useCampuses } from '../context/CampusesContext'
import { AMENITY_OPTIONS, BUILDING_TYPE_OPTIONS } from '../lib/constants'
import Select from './ui/Select'

// How many filters are "active" (i.e. not at their default), for the
// mobile toggle's badge count. campusId is deliberately excluded - it's
// the search context (always set), not an optional refinement.
function countActiveFilters(filters) {
  let count = 0
  if (filters.priceMin) count++
  if (filters.priceMax) count++
  if (filters.maxDistanceKm) count++
  if (filters.buildingType && filters.buildingType !== 'any') count++
  if (filters.minOccupancy) count++
  if (filters.toiletType && filters.toiletType !== 'any') count++
  if (filters.showOnlyAvailable) count++
  count += filters.amenities.length
  return count
}

export default function SearchFilters({ filters, onChange }) {
  const { campuses } = useCampuses()
  // Collapsed by default on mobile only - lg: below always shows the
  // full panel regardless of this state (see the wrapper classes below).
  const [mobileOpen, setMobileOpen] = useState(false)

  function set(field, value) {
    onChange({ ...filters, [field]: value })
  }

  function toggleAmenity(value) {
    const next = filters.amenities.includes(value)
      ? filters.amenities.filter((v) => v !== value)
      : [...filters.amenities, value]
    set('amenities', next)
  }

  const activeCount = countActiveFilters(filters)

  return (
    <div>
      {/* Mobile-only collapsed toggle - hidden at lg: and up, where the
          panel is always expanded exactly as before. */}
      <button
        type="button"
        onClick={() => setMobileOpen((o) => !o)}
        className="lg:hidden w-full flex items-center justify-between gap-2 bg-white rounded-2xl border border-gray-200 shadow-sm px-4 py-3 mb-3"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <SlidersHorizontal size={16} className="text-gray-400" />
          Filters
          {activeCount > 0 && (
            <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full bg-accent text-white text-xs font-medium">
              {activeCount}
            </span>
          )}
        </span>
        {mobileOpen ? (
          <ChevronUp size={16} className="text-gray-400" />
        ) : (
          <ChevronDown size={16} className="text-gray-400" />
        )}
      </button>

      <div
        className={`${mobileOpen ? 'block' : 'hidden'} lg:block bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-5`}
      >
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Campus</label>
          <Select
            value={filters.campusId}
            onChange={(e) => set('campusId', e.target.value)}
          >
            {campuses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Price range (ZMW)</label>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              min="0"
              placeholder="Min"
              value={filters.priceMin}
              onChange={(e) => set('priceMin', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
              />
            <input
              type="number"
              min="0"
              placeholder="Max"
              value={filters.priceMax}
              onChange={(e) => set('priceMax', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
              />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Max distance from campus (km)</label>
          <input
            type="number"
            min="0"
            step="0.5"
            placeholder="Any distance"
            value={filters.maxDistanceKm}
            onChange={(e) => set('maxDistanceKm', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
          />
          {filters.maxDistanceKm && (
            <p className="text-xs text-gray-400 mt-1">
              Listings without a map pin set are hidden while this filter is active.
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Building type</label>
          <Select
            value={filters.buildingType}
            onChange={(e) => set('buildingType', e.target.value)}
          >
            <option value="any">Any</option>
            {BUILDING_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Min. occupancy</label>
          <input
            type="number"
            min="1"
            placeholder="e.g. 2"
            value={filters.minOccupancy}
            onChange={(e) => set('minOccupancy', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Toilet</label>
          <div className="flex gap-4 text-sm text-gray-700">
            {[
              { value: 'any', label: 'Any' },
              { value: 'private', label: 'Private' },
              { value: 'shared', label: 'Shared' },
            ].map((opt) => (
              <label key={opt.value} className="flex items-center gap-1.5">
                <input
                  type="radio"
                  name="toiletFilter"
                  checked={filters.toiletType === opt.value}
                  onChange={() => set('toiletType', opt.value)}
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={filters.showOnlyAvailable}
              onChange={(e) => set('showOnlyAvailable', e.target.checked)}
              className="rounded border-gray-300 text-accent focus:ring-accent"
            />
            Show only available rooms
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Amenities</label>
          <div className="grid grid-cols-2 gap-2">
            {AMENITY_OPTIONS.map((opt) => (
              <label key={opt.value} className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={filters.amenities.includes(opt.value)}
                  onChange={() => toggleAmenity(opt.value)}
                  className="rounded border-gray-300"
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
