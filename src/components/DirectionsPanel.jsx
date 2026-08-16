import { useEffect, useRef, useState } from 'react'
import { Navigation, Loader2 } from 'lucide-react'
import { loadGoogleMapsScript } from '../lib/googleMaps'

const TRAVEL_MODES = [
  { value: 'WALKING', label: 'Walking' },
  { value: 'DRIVING', label: 'Driving' },
]

/** "Show directions from my location" - client-side only. The browser's
 * geolocation result (`origin`) never leaves this component: it's used
 * purely to draw a DirectionsRenderer route on a local map instance and
 * is never sent to Supabase or logged anywhere. */
export default function DirectionsPanel({ destination }) {
  const mapRef = useRef(null)
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY

  const [travelMode, setTravelMode] = useState('WALKING')
  const [origin, setOrigin] = useState(null) // client-side only, never sent anywhere
  const [requestingLocation, setRequestingLocation] = useState(false)
  const [permissionError, setPermissionError] = useState(null) // 'denied' | 'unavailable' | null
  const [routeState, setRouteState] = useState('idle') // idle | loading | ready | error
  const [summary, setSummary] = useState(null)

  function handleRequestLocation() {
    if (!navigator.geolocation) {
      setPermissionError('unavailable')
      return
    }
    setPermissionError(null)
    setRequestingLocation(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setRequestingLocation(false)
        setOrigin({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      },
      (err) => {
        setRequestingLocation(false)
        // code 1 = PERMISSION_DENIED; anything else (unavailable, timeout)
        // gets the same friendly fallback rather than a raw browser error.
        setPermissionError(err.code === 1 ? 'denied' : 'unavailable')
      }
    )
  }

  // Draws (or redraws, on travel mode change) the route once we have an
  // origin. The map container only mounts once `origin` is set (below),
  // so by the time this effect runs after that render, mapRef.current
  // is already in the DOM.
  useEffect(() => {
    if (!origin || !destination) return
    let cancelled = false
    setRouteState('loading')

    async function run() {
      if (!apiKey) {
        if (!cancelled) setRouteState('error')
        return
      }
      try {
        await loadGoogleMapsScript(apiKey)
      } catch {
        if (!cancelled) setRouteState('error')
        return
      }
      if (cancelled || !mapRef.current || !window.google) return

      const map = new window.google.maps.Map(mapRef.current, {
        center: origin,
        zoom: 14,
        disableDefaultUI: true,
        zoomControl: true,
      })
      const directionsService = new window.google.maps.DirectionsService()
      const directionsRenderer = new window.google.maps.DirectionsRenderer({ map })

      directionsService.route(
        { origin, destination, travelMode: window.google.maps.TravelMode[travelMode] },
        (result, status) => {
          if (cancelled) return
          if (status !== 'OK' || !result?.routes?.[0]?.legs?.[0]) {
            setRouteState('error')
            return
          }
          directionsRenderer.setDirections(result)
          const leg = result.routes[0].legs[0]
          setSummary({ distanceText: leg.distance?.text, durationText: leg.duration?.text })
          setRouteState('ready')
        }
      )
    }

    run()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin, travelMode, apiKey])

  if (!destination) return null

  return (
    <div className="mt-4">
      {!origin && (
        <button
          type="button"
          onClick={handleRequestLocation}
          disabled={requestingLocation}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors duration-150 disabled:opacity-60"
        >
          {requestingLocation ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Navigation size={14} />
          )}
          {requestingLocation ? 'Getting your location…' : 'Show directions from my location'}
        </button>
      )}

      {!origin && permissionError && (
        <p className="text-sm text-gray-500 mt-2">
          Turn on location access to see the route from where you are.
        </p>
      )}

      {origin && (
        <div className="mt-1">
          <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
            <p className="text-sm text-gray-500">
              {routeState === 'loading' && 'Getting directions…'}
              {routeState === 'ready' &&
                summary &&
                `${summary.distanceText} · ${summary.durationText} ${
                  travelMode === 'WALKING' ? 'walk' : 'drive'
                }`}
              {routeState === 'error' && 'Directions unavailable right now.'}
            </p>
            <div className="flex items-center rounded-full border border-gray-200 bg-gray-50 p-0.5 text-xs shrink-0">
              {TRAVEL_MODES.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setTravelMode(m.value)}
                  className={`px-2.5 py-1 rounded-full font-medium transition-colors duration-150 ${
                    travelMode === m.value ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          <div ref={mapRef} className="w-full h-64 rounded-xl overflow-hidden border border-gray-200" />
        </div>
      )}
    </div>
  )
}
