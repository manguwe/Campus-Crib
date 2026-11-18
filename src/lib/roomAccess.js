import { supabase } from './supabaseClient'

/** Mobile money numbers students pay to, active ones only (RLS also enforces this). */
export async function fetchReservationPaymentNumbers() {
  const { data, error } = await supabase
    .from('reservation_payment_numbers')
    .select('id, network, phone, account_name')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
  if (error) throw error
  return data || []
}

/** True only when the student's reservation is confirmed and payment is verified. */
export async function canViewRoomDirections(propertyId) {
  const { data, error } = await supabase.rpc('student_can_view_room_directions', { p_property_id: propertyId })
  if (error) throw error
  return Boolean(data)
}

/** The current student's latest open request for a room (pending or confirmed), if any. */
export async function fetchMyRoomReservation(propertyId, studentId) {
  const { data, error } = await supabase
    .from('reservations')
    .select('id, property_id, status, move_in_date, reference_code, owner_response, payment_status, fee_amount, fee_currency, pay_by, payment_note, payment_admin_note, payment_proof_path')
    .eq('property_id', propertyId)
    .eq('student_id', studentId)
    .in('status', ['pending', 'confirmed'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}
