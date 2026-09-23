import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  getPlatformState,
  getSubscriptionStatus,
  subscribeToPush,
  unsubscribeFromPush,
} from '../lib/pushNotifications'

/** Shared state/actions for both the dismissible first-login banner and
 * the persistent dashboard toggle, so the two stay in sync and don't
 * duplicate platform-detection logic. */
export function usePushNotifications() {
  const { user } = useAuth()

  // 'unsupported' | 'ios-needs-install' | 'ready'
  const [platformState, setPlatformState] = useState('unsupported')
  const [permission, setPermission] = useState('default') // 'default' | 'granted' | 'denied' | 'unsupported'
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    setPlatformState(getPlatformState())
    const status = await getSubscriptionStatus()
    setPermission(status.permission)
    setSubscribed(status.subscribed)
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function enable() {
    if (!user) return
    setError('')
    try {
      const result = await subscribeToPush(user.id)
      if (result === 'denied') {
        setPermission('denied')
      } else if (result === 'granted') {
        setPermission('granted')
        setSubscribed(true)
      }
    } catch (err) {
      setError(err.message || 'Could not enable notifications. Please try again.')
    }
  }

  async function disable() {
    setError('')
    try {
      await unsubscribeFromPush()
      setSubscribed(false)
    } catch (err) {
      setError(err.message || 'Could not disable notifications. Please try again.')
    }
  }

  return { platformState, permission, subscribed, loading, error, enable, disable }
}
