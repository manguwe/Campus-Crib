import { useState } from 'react'
import { Bell, Share, X } from 'lucide-react'
import { usePushNotifications } from '../hooks/usePushNotifications'

const DISMISS_KEY = 'cc_push_banner_dismissed'

/** First-login-style nudge, shown once per session then dismissible.
 * Only appears while permission is still undecided ('default') - once
 * granted or denied, the persistent PushNotificationToggle is where
 * status/re-enable messaging lives instead, so this banner doesn't
 * duplicate it. */
export default function PushNotificationBanner() {
  const { platformState, permission, loading, error, enable } = usePushNotifications()
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem(DISMISS_KEY) === '1')
  const [enabling, setEnabling] = useState(false)

  function dismiss() {
    sessionStorage.setItem(DISMISS_KEY, '1')
    setDismissed(true)
  }

  if (loading || dismissed || permission !== 'default' || platformState === 'unsupported') {
    return null
  }

  async function handleEnable() {
    setEnabling(true)
    await enable()
    setEnabling(false)
    dismiss()
  }

  return (
    <div className="bg-primary/5 border border-primary/10 rounded-2xl px-4 py-3 flex items-start gap-3">
      <div className="bg-primary/10 rounded-full p-2 shrink-0">
        <Bell size={16} className="text-primary" />
      </div>

      <div className="flex-1 min-w-0">
        {platformState === 'ios-needs-install' ? (
          <>
            <p className="text-sm font-medium text-gray-900">
              Get notified the moment your listing is approved
            </p>
            <p className="text-sm text-gray-600 mt-1">
              Add Campus Crib to your Home Screen first: tap{' '}
              <Share size={13} className="inline align-text-bottom" /> Share, then "Add to Home
              Screen".
            </p>
          </>
        ) : (
          <>
            <p className="text-sm font-medium text-gray-900">
              Get notified the moment something changes
            </p>
            <p className="text-sm text-gray-600 mt-1">
              Turn on notifications to hear about approvals, messages, and updates - even when the
              app isn't open.
            </p>
            {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
            <button
              onClick={handleEnable}
              disabled={enabling}
              className="mt-2 px-3 py-1.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark transition-colors duration-150 disabled:opacity-60"
            >
              {enabling ? 'Enabling…' : 'Enable notifications'}
            </button>
          </>
        )}
      </div>

      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="p-1 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors duration-150 shrink-0"
      >
        <X size={16} />
      </button>
    </div>
  )
}
