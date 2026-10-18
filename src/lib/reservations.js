import { supabase } from './supabaseClient'

export async function getReservationStatus(propertyId) {
  const { data, error } = await supabase.rpc('get_property_reservation_status', { p_property_id: propertyId })
  if (error) throw error
  return data?.[0] || null
}

export async function requestReservation({ propertyId, moveInDate, moveOutDate, occupants, note }) {
  const { data, error } = await supabase.rpc('request_reservation', {
    p_property_id: propertyId,
    p_move_in_date: moveInDate,
    p_move_out_date: moveOutDate || null,
    p_occupants: Number(occupants || 1),
    p_student_note: note || null,
  })
  if (error) throw error
  return data
}

export async function cancelReservation(id) {
  const { data, error } = await supabase.rpc('cancel_reservation', { p_reservation_id: id })
  if (error) throw error
  return data
}

// Checks for requests the owner never answered (they expire after 24 hours). Errors are ignored on purpose.
export async function refreshStaleReservations() {
  await supabase.rpc('expire_stale_reservation_requests')
}

export async function respondToReservation({ id, accept, note }) {
  const { data, error } = await supabase.rpc('owner_respond_reservation', {
    p_reservation_id: id,
    p_accept: accept,
    p_note: note || null,
  })
  if (error) throw error
  return data
}

export async function confirmReservationAnyway(id, note) {
  const { data, error } = await supabase.rpc('admin_confirm_reservation_anyway', {
    p_reservation_id: id,
    p_admin_note: note || null,
  })
  if (error) throw error
  return data
}

export async function fetchReservationEvents(reservationId) {
  const { data, error } = await supabase
    .from('reservation_events')
    .select('id, event, note, created_at')
    .eq('reservation_id', reservationId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data || []
}

export const RESERVATION_EVENT_LABELS = {
  requested: 'Request sent',
  owner_accepted: 'Owner or agent accepted',
  confirmed: 'Confirmed by Campus Crib',
  confirmed_by_admin: 'Reserved by Campus Crib',
  override: 'Confirmed without an owner response',
  rejected: 'Not approved',
  cancelled: 'Cancelled',
  expired: 'Expired (no response in time)',
}
