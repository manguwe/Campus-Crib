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
