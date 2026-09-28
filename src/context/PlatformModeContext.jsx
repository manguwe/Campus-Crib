import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const PlatformModeContext = createContext({ mode: 'pre_launch', loading: true, refresh: async () => {} })

const STARTUP_TIMEOUT_MS = 6000

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Platform mode request timed out')), ms)),
  ])
}

export function PlatformModeProvider({ children }) {
  const [mode, setMode] = useState('pre_launch')
  const [loading, setLoading] = useState(true)

  async function loadMode() {
    setLoading(true)
    try {
      const { data, error } = await withTimeout(supabase.rpc('get_platform_mode'), STARTUP_TIMEOUT_MS)
      if (error) throw error
      if (['pre_launch', 'public_launch', 'maintenance'].includes(data)) setMode(data)
    } catch (error) {
      // Fail closed: if the settings endpoint is unreachable, show the
      // pre-launch experience instead of holding the entire site on an
      // infinite spinner or accidentally exposing the marketplace.
      console.warn('[PlatformMode] using safe pre-launch fallback:', error?.message || error)
      setMode('pre_launch')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadMode() }, [])

  return (
    <PlatformModeContext.Provider value={{ mode, loading, refresh: loadMode }}>
      {children}
    </PlatformModeContext.Provider>
  )
}

export function usePlatformMode() {
  return useContext(PlatformModeContext)
}
