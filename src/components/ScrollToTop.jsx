import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/** Standard React Router "scroll to top on navigation" pattern - resets
 * scroll position whenever the pathname changes, so a new page never
 * opens mid-scroll from wherever the previous page was left. Rendered
 * once near the top of the router in App.jsx; renders nothing itself. */
export default function ScrollToTop() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return null
}
