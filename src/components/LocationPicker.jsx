import { useEffect, useRef, useState } from 'react'
import { LocateFixed } from 'lucide-react'
import { loadGoogleMapsScript } from '../lib/googleMaps'

// Sensible default center (UNZA Great East Road Campus) so the map has
// somewhere reasonable to open before a landlord has picked a spot.
const DEFAULT_CENTER = { lat: -15.3947, lng: 28.3322 }

/**
 * Props:
 * - latitude, longitude: current value (string or number, '' if unset)
 * - onPick(lat, lng): called (with 6dp-fixed strings) when the map is
 *   clicked or the marker is dragged
 * - onUseMyLocation: optional handler for the "Use my current location"
 *   button - kept as a prop rather than reimplemented here so there's a
 *   single geolocation code path shared with the manual-entry fallback
 *   fields in PropertyEditor.
 */
export default function LocationPicker({ latitude, longitude, onPick, onUseMyLocation }) {
  const mapRef = useRef(null)
  const mapInstance = useRef(null)
  const markerInstance = useRef(null)
  const [loadError, setLoadError] = useState('')
  const [ready, setReady] = useState(false)
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY

  const hasPosition = latitude !== '' && latitude != null && longitude !== '' && longitude != null

  // Load the script and initialise the map + marker once.
  useEffect(() => {
    if (!apiKey) return
    let cancelled = false

    loadGoogleMapsScript(apiKey)
      .then(() => {
        if (cancelled || !mapRef.current || !window.google) return

        const start = hasPosition ? { lat: Number(latitude), lng: Number(longitude) } : DEFAULT_CENTER

        const map = new window.google.maps.Map(mapRef.current, {
          center: start,
          zoom: hasPosition ? 16 : 13,
          disableDefaultUI: true,
          zoomControl: true,
        })

        const marker = new window.google.maps.Marker({
          position: start,
          map,
          draggable: true,
        })

        map.addListener('click', (e) => {
          const lat = e.latLng.lat()
          const lng = e.latLng.lng()
          marker.setPosition({ lat, lng })
          onPick(lat.toFixed(6), lng.toFixed(6))
        })

        marker.addListener('dragend', () => {
          const pos = marker.getPosition()
          onPick(pos.lat().toFixed(6), pos.lng().toFixed(6))
        })

        mapInstance.current = map
        markerInstance.current = marker
        setReady(true)
      })
      .catch((err) => setLoadError(err.message))

    return () => {
      cancelled = true
    }
    // Only ever (re)initialise the map once we have an API key - lat/lng
    // changes after that are handled by the sync effect below, not by
    // recreating the whole map instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey])

  // Keep the marker in sync if lat/lng change from outside the map
  // itself (e.g. the manual-entry fallback fields, or "use my location").
  useEffect(() => {
    if (!ready || !markerInstance.current || !mapInstance.current || !hasPosition) return
    const pos = { lat: Number(latitude), lng: Number(longitude) }
    markerInstance.current.setPosition(pos)
    mapInstance.current.panTo(pos)
  }, [latitude, longitude, ready, hasPosition])

  if (!apiKey || loadError) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-500">
        {!apiKey ? (
          <>
            Map picker needs a Google Maps API key — set{' '}
            <code className="bg-gray-100 px-1 rounded">VITE_GOOGLE_MAPS_API_KEY</code> in{' '}
            <code className="bg-gray-100 px-1 rounded">.env.local</code>.
          </>
        ) : (
          <>Couldn't load the map ({loadError}).</>
        )}{' '}
        You can still enter coordinates manually below.
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5 gap-2">
        <p className="text-xs text-gray-500">Click the map, or drag the pin, to set the location.</p>
        {onUseMyLocation && (
          <button
            type="button"
            onClick={onUseMyLocation}
            className="flex items-center gap-1 shrink-0 text-xs font-medium text-gray-600 underline"
          >
            <LocateFixed size={12} />
            Use my current location
          </button>
        )}
      </div>
      <div ref={mapRef} className="w-full h-64 rounded-xl overflow-hidden border border-gray-200" />
    </div>
  )
}
