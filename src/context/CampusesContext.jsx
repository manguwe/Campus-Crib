import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const CampusesContext = createContext(undefined)

/**
 * Fetches active campuses once and shares them app-wide, the same
 * fetch-once-cache-in-context pattern AuthContext already uses for the
 * user's profile. Source of truth is now the `campuses` table (see
 * 22_campuses_table.sql) - src/lib/campuses.js no longer holds the real
 * list.
 */
export function CampusesProvider({ children }) {
  const [campuses, setCampuses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('campuses')
      .select('id, name, latitude, longitude, is_active')
      .eq('is_active', true)
      .order('name', { ascending: true })

    if (error) setError(error.message)
    else {
      setError('')
      setCampuses(data || [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  function getCampusById(id) {
    return campuses.find((c) => c.id === id) || null
  }

  const value = {
    campuses,
    loading,
    error,
    defaultCampusId: campuses[0]?.id ?? null,
    getCampusById,
    refresh,
  }

  return <CampusesContext.Provider value={value}>{children}</CampusesContext.Provider>
}

export function useCampuses() {
  const ctx = useContext(CampusesContext)
  if (ctx === undefined) {
    throw new Error('useCampuses must be used within a <CampusesProvider>')
  }
  return ctx
}
