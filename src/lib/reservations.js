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
