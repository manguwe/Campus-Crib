import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const PlatformModeContext = createContext({ mode: 'pre_launch', loading: true, refresh: async () => {} })

export function PlatformModeProvider({ children }) {
  const [mode, setMode] = useState('pre_launch')
  const [loading, setLoading] = useState(true)

  async function loadMode() {
    const { data, error } = await supabase.rpc('get_platform_mode')
    if (!error && data) setMode(data)
    setLoading(false)
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
