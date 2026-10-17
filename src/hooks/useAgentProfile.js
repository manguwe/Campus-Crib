import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

/** The signed-in person's agent details, or null when they are not an agent. */
export function useAgentProfile(userId) {
  const [agent, setAgent] = useState(null)
  const [loading, setLoading] = useState(Boolean(userId))

  useEffect(() => {
    let cancelled = false
    if (!userId) {
      setAgent(null)
      setLoading(false)
      return undefined
    }
    ;(async () => {
      const { data } = await supabase
        .from('agent_profiles')
        .select('id, agency_name, service_area')
        .eq('id', userId)
        .maybeSingle()
      if (!cancelled) {
        setAgent(data || null)
        setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [userId])

  return { agent, loading }
}
