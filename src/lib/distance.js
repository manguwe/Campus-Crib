function toRad(deg) {
  return (deg * Math.PI) / 180
}

/** Great-circle distance in kilometres between two lat/lng points. */
export function distanceKm(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null

  const R = 6371 // Earth radius, km
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

export function formatDistanceKm(km) {
  if (km == null) return null
  if (km < 1) return `${Math.round(km * 1000)} m from campus`
  return `${km.toFixed(1)} km from campus`
}
