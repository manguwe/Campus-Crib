import { supabase } from './supabaseClient'

/** Detects iOS/iPadOS specifically (not just any Safari) - iPadOS 13+
 * reports as "Macintosh" in the UA but has touch support, which desktop
 * Macs don't, so that's included as a heuristic too. */
export function isIOS() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const isIPhoneOrIPad = /iPhone|iPad|iPod/.test(ua)
  const isIPadOS13Plus = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
  return isIPhoneOrIPad || isIPadOS13Plus
}

/** True when running installed/"Added to Home Screen", not a regular
 * browser tab. iOS exposes this via the non-standard
 * navigator.standalone; everywhere else (and iOS Safari 16.4+ actually
 * also supports the standard media query) the display-mode media query
 * is the reliable check. */
export function isStandalone() {
  if (typeof window === 'undefined') return false
  return Boolean(window.navigator.standalone) || window.matchMedia('(display-mode: standalone)').matches
}

/** Parses the iOS major.minor version from the UA string (e.g. "16_4"
 * -> 16.4). Returns null if it can't be determined (e.g. not iOS, or
 * iPadOS 13+ masquerading as a Mac, which doesn't include a version in
 * its UA at all - treated as unknown/unsupported rather than guessed). */
export function getIOSVersion() {
  if (typeof navigator === 'undefined') return null
  const match = navigator.userAgent.match(/OS (\d+)_(\d+)/)
  if (!match) return null
  return Number(match[1]) + Number(match[2]) / 10
}

/** Push on iOS specifically requires standalone mode AND iOS 16.4+ -
 * the Push API doesn't exist in a regular Safari tab at all, and didn't
 * exist even in standalone mode before 16.4. */
export function iosSupportsStandalonePush() {
  const version = getIOSVersion()
  return version !== null && version >= 16.4
}

/** One of: 'unsupported' (no Push API at all in this browser/context -
 * e.g. any iOS context below 16.4, or a browser without service worker
 * support), 'ios-needs-install' (iOS, capable device, but running in a
 * plain tab - needs Add to Home Screen first), or 'ready' (can call
 * Notification.requestPermission()/pushManager.subscribe() directly -
 * Android/desktop always, or iOS already running standalone on 16.4+). */
export function getPlatformState() {
  const hasPushApi =
    typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

  if (!hasPushApi) return 'unsupported'

  if (isIOS()) {
    if (!isStandalone()) return 'ios-needs-install'
    if (!iosSupportsStandalonePush()) return 'unsupported'
    return 'ready'
  }

  return 'ready'
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}

/** Requests permission (if not already decided) and subscribes via the
 * browser's PushManager, saving the subscription to push_subscriptions.
 * Returns 'granted', 'denied', or throws on an unexpected failure. */
export async function subscribeToPush(userId) {
  const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
  if (!vapidPublicKey) {
    throw new Error('Push notifications are not configured on this project yet.')
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    return permission
  }

  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
  })

  const json = subscription.toJSON()
  const { error } = await supabase.from('push_subscriptions').insert({
    user_id: userId,
    endpoint: json.endpoint,
    p256dh: json.keys.p256dh,
    auth_key: json.keys.auth,
  })

  // A duplicate endpoint (unique constraint) just means this exact
  // device/browser subscription already exists - not a real failure.
  if (error && error.code !== '23505') throw error

  return 'granted'
}

/** Unsubscribes this device from push and removes its row. Safe to call
 * even if there was never a subscription. */
export async function unsubscribeFromPush() {
  if (!('serviceWorker' in navigator)) return
  const registration = await navigator.serviceWorker.getRegistration()
  const subscription = await registration?.pushManager.getSubscription()
  if (!subscription) return

  const endpoint = subscription.endpoint
  await subscription.unsubscribe()
  await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
}

/** Whether THIS device currently has an active push subscription
 * (checked against the browser's own PushManager, not just the DB, so
 * it's accurate even if the DB row was cleaned up server-side after an
 * expired-subscription send failure). */
export async function getSubscriptionStatus() {
  if (!('serviceWorker' in navigator)) return { permission: 'unsupported', subscribed: false }
  const permission = typeof Notification !== 'undefined' ? Notification.permission : 'default'
  const registration = await navigator.serviceWorker.getRegistration()
  const subscription = await registration?.pushManager.getSubscription()
  return { permission, subscribed: Boolean(subscription) }
}
