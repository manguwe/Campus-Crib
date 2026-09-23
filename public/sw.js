// Campus Crib — service worker for push notifications.
// Registered once from src/main.jsx, guarded by 'serviceWorker' in navigator.
// This file must live at the site root (public/sw.js -> served as /sw.js)
// so its scope covers the whole app, not just one subdirectory.

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    // Fall back to plain text if the payload isn't JSON for some reason.
    data = { body: event.data ? event.data.text() : '' }
  }

  const title = data.title || 'Campus Crib'
  const options = {
    body: data.body || '',
    icon: data.icon || '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: data.url || '/' },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification.data?.url || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus an already-open tab on this origin if one exists, rather
      // than always opening a new one.
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(targetUrl)
          return client.focus()
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl)
      }
    })
  )
})
