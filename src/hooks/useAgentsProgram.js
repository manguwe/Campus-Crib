import { useCallback, useEffect, useState } from 'react'
import { fetchAgentsProgramEnabled } from '../lib/agentsProgram'

/** Whether the agents programme is switched on right now. Defaults to off (paused) if it cannot be read. */
export function useAgentsProgram() {
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setEnabled(await fetchAgentsProgramEnabled())
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { enabled, loading, refresh }
}
