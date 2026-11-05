import { useEffect, useState } from 'react'
import { fetchSitePromotions } from '../lib/promotions'

/** The community popup settings (null until loaded, or if they cannot be read). */
export function useSitePromotions() {
  const [promotions, setPromotions] = useState(null)

  useEffect(() => {
    let cancelled = false
    fetchSitePromotions().then((data) => {
      if (!cancelled) setPromotions(data)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return promotions
}
