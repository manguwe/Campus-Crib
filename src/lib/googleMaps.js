let loadingPromise = null

export function loadGoogleMapsScript(apiKey) {
  if (window.google?.maps) return Promise.resolve()
  if (loadingPromise) return loadingPromise

  loadingPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => {
      loadingPromise = null // allow a retry on next call instead of caching a permanent failure
      reject(new Error('Failed to load Google Maps'))
    }
    document.head.appendChild(script)
  })

  return loadingPromise
}

// Lightweight hand-off to Google Maps itself (app if installed, else a
// browser tab) - no API key or map rendering needed. Omitting `origin`
// makes Google Maps use the visitor's current location automatically.
export function directionsUrl(latitude, longitude, mode = 'walking') {
  return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=${mode}`
}
