import {
  Wifi,
  Droplet,
  Zap,
  ShieldCheck,
  Car,
  BatteryCharging,
  BookOpen,
  Camera,
  Bus,
  Utensils,
  CheckCircle2,
} from 'lucide-react'

import { AMENITY_OPTIONS } from './constants'

// Best-effort mapping — every amenity gets *an* icon, even if a couple
// (tiled floor, ceiling fitted) fall back to a generic checkmark since
// there's no obviously-better icon for them in this set.
export const AMENITY_ICONS = {
  tiled_floor: CheckCircle2,
  ceiling_fitted: CheckCircle2,
  fridge: Utensils,
  stove: Utensils,
  wifi: Wifi,
  water_included: Droplet,
  electricity_included: Zap,
  security_guard: ShieldCheck,
  parking: Car,
  backup_power: BatteryCharging,
  study_desk: BookOpen,
  cctv: Camera,
  borehole_water: Droplet,
  shuttle_minibus_nearby: Bus,
}

export function getAmenityIcon(value) {
  return AMENITY_ICONS[value] || CheckCircle2
}

/**
 * Every amenity chip - preset checklist or landlord-typed custom text -
 * goes through this before display, so nothing ever shows a raw
 * snake_case database key. Preset values use their proper AMENITY_OPTIONS
 * label; anything else (custom amenities, or a preset key that's since
 * drifted out of AMENITY_OPTIONS) falls back to humanizing the raw
 * string: underscores -> spaces, first letter capitalized.
 */
export function getAmenityLabel(value) {
  const preset = AMENITY_OPTIONS.find((opt) => opt.value === value)
  if (preset) return preset.label

  const humanized = value.replace(/_/g, ' ')
  return humanized.charAt(0).toUpperCase() + humanized.slice(1)
}
