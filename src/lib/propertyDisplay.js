import { BUILDING_TYPE_LABELS } from './constants'

export function toiletLabel(property) {
  if (!property.toilet_shared_by || property.toilet_shared_by <= 1) {
    return 'Private toilet'
  }
  return `Toilet shared by ${property.toilet_shared_by} people`
}

export function occupancyLabel(occupancy) {
  if (!occupancy) return null
  return occupancy >= 5 ? 'Room for 5+' : `Room for ${occupancy}`
}

/**
 * Returns the pieces of the one-line summary, e.g.:
 * ["Room for 2", "Private toilet", "5 min walk to UNZA"]
 * Callers join with " · ". Any field that's null/unset is simply omitted
 * rather than shown as blank. room_type is deliberately not read here -
 * it's redundant with occupancy and was removed from the UI (the column
 * itself is untouched in the database, see PropertyEditor.jsx).
 *
 * `campusName` is optional - pass the name of the property's
 * primary_campus_id (resolved by the caller via useCampuses(), since
 * this file has no data-fetching of its own) to name the actual campus
 * in the walk-time text. Falls back to the old generic "to campus"
 * wording for any listing that doesn't have that field set yet.
 */
export function propertySummaryParts(property, campusName) {
  const parts = []

  if (property.occupancy) {
    parts.push(occupancyLabel(property.occupancy))
  }
  parts.push(toiletLabel(property))
  if (property.walk_minutes_to_campus !== null && property.walk_minutes_to_campus !== undefined) {
    parts.push(`${property.walk_minutes_to_campus} min walk to ${campusName || 'campus'}`)
  }

  return parts
}

export function buildingTypeLabel(property) {
  if (!property.building_type) return null
  return BUILDING_TYPE_LABELS[property.building_type] || property.building_type
}
