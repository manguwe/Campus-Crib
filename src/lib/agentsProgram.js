import { supabase } from './supabaseClient'

// The agents programme has an on/off switch controlled by admins. Off means "paused": agent signup is hidden
// and the database blocks agents from adding or editing listings.

export async function fetchAgentsProgramEnabled() {
  const { data, error } = await supabase.rpc('agents_program_enabled')
  if (error) return false
  return data === true
}

export async function setAgentsProgramEnabled(enabled) {
  const { error } = await supabase.rpc('set_agents_program', { p_enabled: enabled })
  return { error }
}

// Second switch: whether agent listings are shown to the public. Defaults to visible if it cannot be read.
export async function fetchAgentListingsVisible() {
  const { data, error } = await supabase.rpc('agent_listings_visible')
  if (error) return true
  return data !== false
}

export async function setAgentListingsVisible(visible) {
  const { error } = await supabase.rpc('set_agent_listings_visible', { p_visible: visible })
  return { error }
}

// ---- Agent access fee (editable by admins) -------------------------------------------------------

export async function fetchAgentFeeSettings() {
  const { data, error } = await supabase.rpc('get_agent_fee_settings')
  if (error) throw error
  return data
}

export async function saveAgentFeeSettings({ amount, currency, instructions, accessDays, accessOnSubmit }) {
  const { error } = await supabase.rpc('set_agent_fee_settings', {
    p_amount: Number(amount),
    p_currency: currency,
    p_instructions: instructions,
    p_access_days: Number(accessDays),
    p_access_on_submit: accessOnSubmit,
  })
  if (error) throw error
}

export async function fetchMyAgentAccess() {
  const { data, error } = await supabase.rpc('my_agent_access')
  if (error) return null
  return data
}

export async function reviewAgentPayment(paymentId, confirm, note) {
  const { error } = await supabase.rpc('admin_review_agent_payment', {
    p_payment_id: paymentId,
    p_confirm: confirm,
    p_note: note || null,
  })
  if (error) throw error
}

export async function setAgentAccess(agentId, { waived, revoked, note }) {
  const { error } = await supabase.rpc('admin_set_agent_access', {
    p_agent: agentId,
    p_waived: Boolean(waived),
    p_revoked: Boolean(revoked),
    p_note: note || null,
  })
  if (error) throw error
}
