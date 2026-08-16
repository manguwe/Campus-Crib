/** Groups a flat list of {property_id, rating} rows into {[property_id]: {average, count}}. */
export function groupRatingsByProperty(reviewRows) {
  const buckets = {}
  for (const row of reviewRows || []) {
    if (!buckets[row.property_id]) buckets[row.property_id] = []
    buckets[row.property_id].push(row.rating)
  }
  const result = {}
  for (const [propertyId, ratings] of Object.entries(buckets)) {
    result[propertyId] = {
      average: ratings.reduce((sum, r) => sum + r, 0) / ratings.length,
      count: ratings.length,
    }
  }
  return result
}
