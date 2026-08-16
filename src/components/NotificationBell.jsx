import { useEffect, useRef, useState } from 'react'
import { Bell, Megaphone } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'

export default function NotificationBell() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)

  async function loadNotifications() {
    const { data, error } = await supabase
      .from('notifications')
      .select('id, message, is_read, type, created_at')
      .order('created_at', { ascending: false })
      .limit(20)
    if (!error) setNotifications(data)
  }

  useEffect(() => {
    if (!user?.id) return

    loadNotifications()

    const topic = `notifications:${user.id}`

    // React 18 StrictMode runs this effect, its cleanup, and then this
    // effect again, all synchronously, on every mount in development.
    // supabase.removeChannel() unsubscribes over the websocket
    // asynchronously though, so the *first* invocation's channel can
    // still be registered with the client when the *second* invocation
    // tries to open a new channel on the same topic - and calling
    // .on() on a channel whose sibling-by-topic has already called
    // .subscribe() is what throws "cannot add postgres_changes
    // callbacks... after subscribe()". Proactively remove any
    // already-registered channel for this exact topic first, so each
    // invocation always starts from a clean slate instead of racing the
    // previous one's async cleanup.
    const stale = supabase.getChannels().find((c) => c.topic === `realtime:${topic}`)
    if (stale) {
      supabase.removeChannel(stale)
    }

    let isActive = true
    const channel = supabase.channel(topic)

    // Attach every .on() handler before calling .subscribe() - once a
    // channel is subscribed, Realtime refuses to attach further
    // callbacks to it.
    channel.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
      (payload) => {
        if (isActive) setNotifications((prev) => [payload.new, ...prev])
      }
    )

    channel.subscribe()

    return () => {
      isActive = false
      supabase.removeChannel(channel)
    }
  }, [user?.id])

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const unreadCount = notifications.filter((n) => !n.is_read).length

  async function markAsRead(id) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)))
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
  }

  async function markAllAsRead() {
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id)
    if (unreadIds.length === 0) return
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
    await supabase.from('notifications').update({ is_read: true }).in('id', unreadIds)
  }

  if (!user) return null

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        className="relative p-1.5 rounded-lg hover:bg-gray-100"
      >
        <Bell size={18} className="text-gray-600" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] leading-none rounded-full px-1 py-0.5 min-w-[16px] text-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl border border-gray-200 shadow-sm shadow-lg z-10">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="text-sm font-medium text-gray-900">Notifications</span>
            {unreadCount > 0 && (
              <button onClick={markAllAsRead} className="text-xs text-gray-500 underline">
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="text-sm text-gray-400 px-4 py-6 text-center">No notifications yet.</p>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => markAsRead(n.id)}
                  className={`w-full text-left px-4 py-3 text-sm border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors duration-150 ${
                    n.is_read ? 'text-gray-500' : 'text-gray-900 font-medium'
                  }`}
                >
                  <span className="flex items-start gap-1.5">
                    {n.type === 'announcement' && (
                      <Megaphone size={13} className="text-primary shrink-0 mt-0.5" />
                    )}
                    {n.message}
                  </span>
                  <div className="text-xs text-gray-400 mt-1 font-normal">
                    {new Date(n.created_at).toLocaleString()}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
