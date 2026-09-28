import { useEffect, useState } from 'react'
import { Download, Share2, X } from 'lucide-react'
import { isIOS, isStandalone } from '../lib/pushNotifications'

export default function PWAInstallButton({ mobile = false }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [showIosHelp, setShowIosHelp] = useState(false)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    if (isStandalone()) {
      setInstalled(true)
      return
    }

    const onBeforeInstall = (event) => {
      event.preventDefault()
      setDeferredPrompt(event)
    }
    const onInstalled = () => {
      setDeferredPrompt(null)
      setInstalled(true)
      setShowIosHelp(false)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (installed) return null

  const ios = isIOS()
  if (!ios && !deferredPrompt) return null

  async function install() {
    if (ios) {
      setShowIosHelp(true)
      return
    }
    const prompt = deferredPrompt
    if (!prompt) return
    await prompt.prompt()
    await prompt.userChoice
    setDeferredPrompt(null)
  }

  return (
    <div className={mobile ? 'px-0 py-1' : 'relative'}>
      <button
        type="button"
        onClick={install}
        className={mobile
          ? 'w-full flex items-center gap-2 py-2 text-left text-gray-700 hover:text-primary'
          : 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary/20 text-primary text-sm font-medium hover:bg-primary/5'}
      >
        {ios ? <Share2 size={16} /> : <Download size={16} />}
        Install Campus Crib
      </button>

      {showIosHelp && (
        <div className={mobile
          ? 'mt-2 rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600'
          : 'absolute right-0 mt-2 w-80 rounded-xl border border-gray-200 bg-white p-4 shadow-lg z-50'}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-gray-900">Install on iPhone/iPad</p>
              <p className="mt-1">Open Campus Crib in Safari, tap Share, choose <b>Add to Home Screen</b>, turn on <b>Open as Web App</b>, then tap Add.</p>
              <p className="mt-2">After installing, open Campus Crib from the Home Screen. That is also the required mode for iPhone push notifications.</p>
            </div>
            <button type="button" onClick={() => setShowIosHelp(false)} aria-label="Close" className="text-gray-400 hover:text-gray-700"><X size={16}/></button>
          </div>
        </div>
      )}
    </div>
  )
}
