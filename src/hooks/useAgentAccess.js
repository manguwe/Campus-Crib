import { useCallback, useEffect, useState } from 'react'
import { fetchMyAgentAccess } from '../lib/agentsProgram'

/** The signed-in agent's access to post listings (fee, payment status, dates). null for people who are not agents. */
export function useAgentAccess(userId) {
  const [access, setAccess] = useState(null)
  const [loading, setLoading] = useState(Boolean(userId))

  const refresh = useCallback(async () => {
    if (!userId) {
      setAccess(null)
      setLoading(false)
      return
    }
    setAccess(await fetchMyAgentAccess())
    setLoading(false)
  }, [userId])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { access, loading, refresh }
}
