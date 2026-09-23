import { useEffect, useState } from 'react'
import { Loader2, Sparkles, X } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { logActivity } from '../lib/activityLog'
import { useCampuses } from '../context/CampusesContext'
import { BUILDING_TYPE_OPTIONS, BUILDING_TYPE_LABELS, AMENITY_OPTIONS, AMENITY_LABELS } from '../lib/constants'

const AI_COOLDOWN_SECONDS = 8

const VALID_BUILDING_TYPES = new Set(BUILDING_TYPE_OPTIONS.map((o) => o.value))
const VALID_AMENITIES = new Set(AMENITY_OPTIONS.map((o) => o.value))

/** Turns the AI's raw JSON into: (a) the partial filter update to apply
 * to Browse's existing filter state, and (b) a list of removable chips
 * describing what was understood. Defensively re-validates every value
 * against the real vocabulary, even though the Edge Function is already
 * instructed not to invent values outside it. `campuses` is the live,
 * admin-managed list from useCampuses() - passed in rather than
 * imported, since it's no longer static. */
function interpretAiFilters(raw, currentFilters, campuses) {
  const update = {}
  const chips = []

  const matchedCampus = typeof raw?.campus === 'string' ? campuses.find((c) => c.id === raw.campus) : null
  if (matchedCampus) {
    update.campusId = matchedCampus.id
    chips.push({ field: 'campusId', resetValue: currentFilters.campusId, label: `Near ${matchedCampus.name}` })
  }

  if (typeof raw?.min_price === 'number' && raw.min_price >= 0) {
    update.priceMin = String(Math.round(raw.min_price))
    chips.push({ field: 'priceMin', resetValue: '', label: `From ZMW ${Math.round(raw.min_price).toLocaleString()}` })
  }

  if (typeof raw?.max_price === 'number' && raw.max_price >= 0) {
    update.priceMax = String(Math.round(raw.max_price))
    chips.push({ field: 'priceMax', resetValue: '', label: `Under ZMW ${Math.round(raw.max_price).toLocaleString()}` })
  }

  if (typeof raw?.building_type === 'string' && VALID_BUILDING_TYPES.has(raw.building_type)) {
    update.buildingType = raw.building_type
    chips.push({
      field: 'buildingType',
      resetValue: 'any',
      label: BUILDING_TYPE_LABELS[raw.building_type] || raw.building_type,
    })
  }

  if (Number.isInteger(raw?.occupancy) && raw.occupancy >= 1 && raw.occupancy <= 10) {
    update.minOccupancy = String(raw.occupancy)
    chips.push({ field: 'minOccupancy', resetValue: '', label: `${raw.occupancy}+ occupancy` })
  }

  if (raw?.toilet_type === 'private' || raw?.toilet_type === 'shared') {
    update.toiletType = raw.toilet_type
    chips.push({
      field: 'toiletType',
      resetValue: 'any',
      label: raw.toilet_type === 'private' ? 'Private toilet' : 'Shared toilet',
    })
  }

  if (typeof raw?.max_distance_km === 'number' && raw.max_distance_km >= 0) {
    update.maxDistanceKm = String(raw.max_distance_km)
    chips.push({ field: 'maxDistanceKm', resetValue: '', label: `Within ${raw.max_distance_km} km` })
  }

  if (Array.isArray(raw?.amenities)) {
    const validAmenities = raw.amenities.filter((a) => VALID_AMENITIES.has(a))
    if (validAmenities.length > 0) {
      update.amenities = Array.from(new Set([...currentFilters.amenities, ...validAmenities]))
      for (const a of validAmenities) {
        chips.push({ field: 'amenities', amenityValue: a, resetValue: null, label: AMENITY_LABELS[a] || a })
      }
    }
  }

  return { update, chips }
}

export default function AiSearchBar({ filters, onChange }) {
  const { campuses } = useCampuses()
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [cooldown, setCooldown] = useState(0)
  const [chips, setChips] = useState([])

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(timer)
  }, [cooldown])

  async function handleSearch(e) {
    e.preventDefault()
    setError('')

    if (!query.trim()) {
      setError("Describe what you're looking for first.")
      return
    }

    setLoading(true)

    const vocabulary = {
      campuses: campuses.map((c) => ({ id: c.id, name: c.name })),
      buildingTypes: BUILDING_TYPE_OPTIONS.map((o) => o.value),
      amenities: AMENITY_OPTIONS.map((o) => o.value),
    }

    // Only translates free text into structured filter values - the
    // actual search still runs through Browse's normal Supabase query,
    // so the AI can never surface a listing that doesn't really match.
    const { data, error: invokeError } = await supabase.functions.invoke('ai-search-listings', {
      body: { query: query.trim(), vocabulary },
    })

    setLoading(false)
    setCooldown(AI_COOLDOWN_SECONDS)

    const fallbackMessage = "Couldn't interpret that search right now — please try again or use the filters below."

    if (invokeError) {
      let message = fallbackMessage
      try {
        const body = await invokeError.context.json()
        if (body?.error) message = body.error
      } catch {
        // Edge Function unreachable or returned a non-JSON body - keep the fallback message.
      }
      setError(message)
      return
    }

    const { update, chips: newChips } = interpretAiFilters(data?.filters, filters, campuses)

    if (newChips.length === 0) {
      setError("Couldn't pick out any specific filters from that — try adding a price, campus, or amenity.")
      return
    }

    onChange({ ...filters, ...update })
    setChips(newChips)
    logActivity('ai_search_used', { details: { query: query.trim() } })
  }

  function removeChip(chip) {
    if (chip.field === 'amenities') {
      onChange({ ...filters, amenities: filters.amenities.filter((v) => v !== chip.amenityValue) })
    } else {
      onChange({ ...filters, [chip.field]: chip.resetValue })
    }
    setChips((prev) => prev.filter((c) => c !== chip))
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
      <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Describe what you're looking for — e.g. self-contained room near UNZA under 1500 with wifi"
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <button
          type="submit"
          disabled={loading || cooldown > 0}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark transition-colors duration-150 disabled:opacity-60 shrink-0"
        >
          {loading ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Searching…
            </>
          ) : (
            <>
              <Sparkles size={14} />
              {cooldown > 0 ? `Search with AI (${cooldown}s)` : 'Search with AI'}
            </>
          )}
        </button>
      </form>

      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}

      {chips.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {chips.map((chip, i) => (
            <span
              key={`${chip.field}-${chip.amenityValue || i}`}
              className="inline-flex items-center gap-1 text-xs font-medium bg-accent/10 text-accent rounded-full pl-2.5 pr-1.5 py-1"
            >
              {chip.label}
              <button
                type="button"
                onClick={() => removeChip(chip)}
                aria-label={`Remove ${chip.label}`}
                className="hover:bg-accent/20 rounded-full p-0.5"
              >
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
