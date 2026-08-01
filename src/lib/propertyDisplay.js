import { ROOM_TYPE_LABELS, BUILDING_TYPE_LABELS } from './constants'

export function toiletLabel(property) {
  if (!property.toilet_shared_by || property.toilet_shared_by <= 0) {
    return 'Private bathroom'
  }
  return `Shared by ${property.toilet_shared_by} people`
}

/**
 * Returns the pieces of the one-line summary, e.g.:
 * ["Self-contained", "Fits 2", "Private bathroom", "5 min walk to campus"]
 * Callers join with " · ". Any field that's null/unset is simply omitted
 * rather than shown as blank.
 */
export function propertySummaryParts(property) {
  const parts = []

  if (property.room_type && ROOM_TYPE_LABELS[property.room_type]) {
    parts.push(ROOM_TYPE_LABELS[property.room_type])
  }
  if (property.occupancy) {
    parts.push(`Fits ${property.occupancy}`)
  }
  parts.push(toiletLabel(property))
  if (property.walk_minutes_to_campus !== null && property.walk_minutes_to_campus !== undefined) {
    parts.push(`${property.walk_minutes_to_campus} min walk to campus`)
  }

  return parts
}

export function buildingTypeLabel(property) {
  if (!property.building_type) return null
  return BUILDING_TYPE_LABELS[property.building_type] || property.building_type
}
