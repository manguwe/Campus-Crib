export const AMENITY_OPTIONS = [
  { value: 'tiled_floor', label: 'Tiled floor' },
  { value: 'ceiling_fitted', label: 'Ceiling fitted' },
  { value: 'fridge', label: 'Fridge' },
  { value: 'stove', label: 'Stove' },
  { value: 'wifi', label: 'WiFi' },
  { value: 'water_included', label: 'Water included' },
  { value: 'electricity_included', label: 'Electricity included' },
  { value: 'security_guard', label: 'Security guard' },
  { value: 'parking', label: 'Parking' },
  { value: 'backup_power', label: 'Backup power' },
  { value: 'study_desk', label: 'Study desk' },
  { value: 'cctv', label: 'CCTV' },
  { value: 'borehole_water', label: 'Borehole water' },
  { value: 'shuttle_minibus_nearby', label: 'Shuttle/minibus nearby' },
]

export const AMENITY_LABELS = AMENITY_OPTIONS.reduce((acc, opt) => {
  acc[opt.value] = opt.label
  return acc
}, {})

// "5+" is stored as a plain 5 in the occupancy integer column - simplest
// option that still round-trips cleanly without a separate "is this
// exact" flag; occupancyLabel() in propertyDisplay.js renders 5 back out
// as "Room for 5+".
export const OCCUPANCY_OPTIONS = [
  { value: 1, label: 'Room for 1' },
  { value: 2, label: 'Room for 2' },
  { value: 3, label: 'Room for 3' },
  { value: 4, label: 'Room for 4' },
  { value: 5, label: 'Room for 5+' },
]

export const ROOM_TYPE_OPTIONS = [
  { value: 'single', label: 'Single room' },
  { value: 'shared', label: 'Shared room' },
  { value: 'self_contained', label: 'Self-contained' },
  { value: 'bedsitter', label: 'Bedsitter' },
  { value: 'other', label: 'Other' },
]

export const ROOM_TYPE_LABELS = ROOM_TYPE_OPTIONS.reduce((acc, opt) => {
  acc[opt.value] = opt.label
  return acc
}, {})

export const BUILDING_TYPE_OPTIONS = [
  { value: 'apartment', label: 'Apartment' },
  { value: 'cottage', label: 'Cottage' },
  { value: 'main_house', label: 'Main house' },
  { value: 'boarding_house', label: 'Boarding house' },
  { value: 'other', label: 'Other' },
]

export const BUILDING_TYPE_LABELS = BUILDING_TYPE_OPTIONS.reduce((acc, opt) => {
  acc[opt.value] = opt.label
  return acc
}, {})

export const STATUS_BADGE_STYLES = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
}

// Availability status is a separate, landlord-editable field from the
// `status` moderation state above - see 18_property_availability_status.sql.
export const AVAILABILITY_STATUS_OPTIONS = [
  { value: 'available', label: 'Available' },
  { value: 'on_hold', label: 'On hold' },
  { value: 'taken', label: 'Fully booked' },
]

export const AVAILABILITY_STATUS_LABELS = AVAILABILITY_STATUS_OPTIONS.reduce((acc, opt) => {
  acc[opt.value] = opt.label
  return acc
}, {})

export const AVAILABILITY_STATUS_BADGE_STYLES = {
  available: 'bg-green-100 text-green-800',
  on_hold: 'bg-amber-100 text-amber-800',
  taken: 'bg-red-100 text-red-800',
}

export const AVAILABILITY_STATUS_DOT_COLORS = {
  available: 'bg-green-500',
  on_hold: 'bg-amber-500',
  taken: 'bg-red-500',
}

// Listing reports (property_reports) - see 19_property_reports_table.sql
export const REPORT_REASON_OPTIONS = [
  { value: 'fake_listing', label: 'This listing looks fake' },
  { value: 'misleading_info', label: 'The information is misleading' },
  { value: 'inappropriate_content', label: 'Inappropriate content' },
  { value: 'scam_or_fraud', label: 'Scam or fraud attempt' },
  { value: 'other', label: 'Other' },
]

export const REPORT_REASON_LABELS = REPORT_REASON_OPTIONS.reduce((acc, opt) => {
  acc[opt.value] = opt.label
  return acc
}, {})

export const REPORT_STATUS_BADGE_STYLES = {
  pending: 'bg-yellow-100 text-yellow-800',
  reviewed: 'bg-green-100 text-green-800',
  dismissed: 'bg-gray-100 text-gray-600',
}
