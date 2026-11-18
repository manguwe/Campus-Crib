import { supabase } from './supabaseClient'

export const METRIC_RANGES = [
  { value: 7, label: 'Last 7 days' },
  { value: 30, label: 'Last 30 days' },
  { value: null, label: 'All time' },
]

/** Per-room figures for the signed-in landlord. `days` null means all time. */
export async function fetchLandlordRoomMetrics(days) {
  const { data, error } = await supabase.rpc('landlord_room_metrics', { p_days: days })
  if (error) throw error
  return (data || []).map((r) => ({ ...r, views: Number(r.views || 0), confirmed_reservations: Number(r.confirmed_reservations || 0) }))
}

/** Counts that the summary cards show. Occupied = fully booked, unoccupied = available, on hold = maintenance or renovation too. */
export function summarizeRooms(rows) {
  const count = (fn) => rows.filter(fn).length
  return {
    listed: rows.length,
    approved: count((r) => r.status === 'approved'),
    rejected: count((r) => r.status === 'rejected'),
    occupied: count((r) => r.availability_status === 'taken'),
    unoccupied: count((r) => r.availability_status === 'available'),
    onHold: count((r) => r.availability_status === 'on_hold'),
    views: rows.reduce((sum, r) => sum + r.views, 0),
    confirmedReservations: rows.reduce((sum, r) => sum + r.confirmed_reservations, 0),
  }
}
