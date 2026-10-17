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
