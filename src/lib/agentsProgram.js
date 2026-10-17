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
