import { Bell, BellOff, Share } from 'lucide-react'
import { usePushNotifications } from '../hooks/usePushNotifications'

/** Persistent, always-visible control (unlike the dismissible
 * PushNotificationBanner) so a user can revisit this later even if
 * they dismissed the first prompt - reflects current subscription
 * status accurately for all three platform states. */
export default function PushNotificationToggle() {
  const { platformState, permission, subscribed, loading, error, enable, disable } = usePushNotifications()

  if (loading) return null

  if (platformState === 'unsupported') {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-400 bg-gray-50 rounded-xl px-4 py-3">
        <BellOff size={16} />
        Push notifications aren't supported in this browser.
      </div>
    )
  }

  if (platformState === 'ios-needs-install') {
    return (
      <div className="flex items-start gap-2 text-sm text-gray-600 bg-gray-50 rounded-xl px-4 py-3">
        <Share size={16} className="shrink-0 mt-0.5" />
        <span>
          To enable notifications on iPhone/iPad, first add Campus Crib to your Home Screen (Share
          → Add to Home Screen), then open it from there.
        </span>
      </div>
    )
  }

  if (permission === 'denied') {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500 bg-gray-50 rounded-xl px-4 py-3">
        <BellOff size={16} />
        Notifications are blocked. You can re-enable them in your browser/device settings.
      </div>
    )
  }

  if (permission === 'granted' && subscribed) {
    return (
      <div className="flex items-center justify-between gap-3 bg-accent/10 rounded-xl px-4 py-3">
        <span className="flex items-center gap-2 text-sm font-medium text-accent">
          <Bell size={16} />
          Notifications on
        </span>
        <button onClick={disable} className="text-xs font-medium text-gray-500 hover:underline">
          Turn off
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between gap-3 bg-gray-50 rounded-xl px-4 py-3">
      <span className="text-sm text-gray-600">Get notified even when the app isn't open.</span>
      <button
        onClick={enable}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark transition-colors duration-150 shrink-0"
      >
        <Bell size={14} />
        Enable notifications
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
