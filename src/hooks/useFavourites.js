import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { logActivity } from '../lib/activityLog'

export function useFavourites() {
  const { user, role } = useAuth()
  const [favouriteIds, setFavouriteIds] = useState(new Set())
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!user || role !== 'student') {
      setFavouriteIds(new Set())
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error } = await supabase.from('favourites').select('property_id').eq('student_id', user.id)
    if (!error) {
      setFavouriteIds(new Set((data || []).map((f) => f.property_id)))
    }
    setLoading(false)
  }, [user, role])

  useEffect(() => {
    load()
  }, [load])

  const toggleFavourite = useCallback(
    async (propertyId) => {
      if (!user || role !== 'student') {
        return { requiresLogin: true }
      }

      const wasFavourited = favouriteIds.has(propertyId)

      // Optimistic update - flip the UI immediately, roll back on failure.
      setFavouriteIds((prev) => {
        const next = new Set(prev)
        if (wasFavourited) next.delete(propertyId)
        else next.add(propertyId)
        return next
      })

      const { error } = wasFavourited
        ? await supabase.from('favourites').delete().eq('student_id', user.id).eq('property_id', propertyId)
        : await supabase.from('favourites').insert({ student_id: user.id, property_id: propertyId })

      if (error) {
        setFavouriteIds((prev) => {
          const next = new Set(prev)
          if (wasFavourited) next.add(propertyId)
          else next.delete(propertyId)
          return next
        })
        return { error }
      }

      logActivity(wasFavourited ? 'favourite_removed' : 'favourite_added', {
        details: { property_id: propertyId },
      })

      return {}
    },
    [favouriteIds, user, role]
  )

  return { favouriteIds, loading, toggleFavourite, refresh: load }
}
