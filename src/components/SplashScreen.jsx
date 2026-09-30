import { useEffect, useState } from 'react'
import logoIcon from '../assets/logo-icon.png'

export default function SplashScreen() {
  const [visible, setVisible] = useState(true)
  const [mounted, setMounted] = useState(true)

  useEffect(() => {
    const hideTimer = window.setTimeout(() => setVisible(false), 1150)
    const removeTimer = window.setTimeout(() => setMounted(false), 1550)
    return () => {
      window.clearTimeout(hideTimer)
      window.clearTimeout(removeTimer)
    }
  }, [])

  if (!mounted) return null

  return (
    <div className={`site-splash ${visible ? 'site-splash-visible' : 'site-splash-hidden'}`} aria-hidden="true">
      <div className="site-splash-content">
        <div className="site-splash-logo-wrap">
          <img src={logoIcon} alt="" className="site-splash-logo" />
        </div>
        <div className="site-splash-name">Campus Crib</div>
        <div className="site-splash-line" />
      </div>
    </div>
  )
}
