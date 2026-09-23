export function summarizeActivity(eventType, details) {
  const d = details || {}

  switch (eventType) {
    case 'page_view':
      return null // the path column already says everything useful
    case 'login':
    case 'signup':
      return d.role ? `role: ${d.role}` : null
    case 'logout':
      return d.role ? `was: ${d.role}` : null
    case 'listing_created':
    case 'listing_updated':
      return d.property_id ? `property ${shortId(d.property_id)}` : null
    case 'favourite_added':
    case 'favourite_removed':
      return d.property_id ? `property ${shortId(d.property_id)}` : null
    case 'review_submitted':
      return d.property_id
        ? `property ${shortId(d.property_id)}${d.rating ? ` · ${d.rating}★` : ''}`
        : null
    case 'search_performed': {
      const parts = []
      if (d.campus) parts.push(`campus: ${d.campus}`)
      if (d.priceMin || d.priceMax) parts.push(`price: ${d.priceMin || '0'}–${d.priceMax || '∞'}`)
      if (d.buildingType && d.buildingType !== 'any') parts.push(`type: ${d.buildingType}`)
      if (d.minOccupancy) parts.push(`min occ: ${d.minOccupancy}`)
      if (d.toiletType && d.toiletType !== 'any') parts.push(`toilet: ${d.toiletType}`)
      if (d.maxDistanceKm) parts.push(`≤ ${d.maxDistanceKm}km`)
      if (d.amenities?.length) parts.push(`${d.amenities.length} amenities`)
      return parts.length > 0 ? parts.join(', ') : 'no filters'
    }
    case 'error':
      return d.message || 'no message'
    default:
      return Object.keys(d).length > 0 ? JSON.stringify(d) : null
  }
}

function shortId(id) {
  return typeof id === 'string' ? id.slice(0, 8) : id
}
