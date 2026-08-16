import { useEffect, useRef, useState } from 'react'
import { loadGoogleMapsScript } from '../lib/googleMaps'

export default function GoogleMapPin({ latitude, longitude, title }) {
  const mapRef = useRef(null)
  const [loadError, setLoadError] = useState('')
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY

  useEffect(() => {
    if (latitude == null || longitude == null || !apiKey) return

    let cancelled = false
    loadGoogleMapsScript(apiKey)
      .then(() => {
        if (cancelled || !mapRef.current || !window.google) return
        const position = { lat: Number(latitude), lng: Number(longitude) }
        const map = new window.google.maps.Map(mapRef.current, {
          center: position,
          zoom: 15,
          disableDefaultUI: true,
          zoomControl: true,
        })
        new window.google.maps.Marker({ position, map, title })
      })
      .catch((err) => setLoadError(err.message))

    return () => {
      cancelled = true
    }
  }, [latitude, longitude, apiKey, title])

  if (latitude == null || longitude == null) {
    return <p className="text-sm text-gray-400">Location not provided by the landlord yet.</p>
  }

  const externalMapUrl = `https://www.google.com/maps?q=${latitude},${longitude}`

  if (!apiKey || loadError) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-500">
        {!apiKey ? (
          <>
            Map preview needs a Google Maps API key — set{' '}
            <code className="bg-gray-100 px-1 rounded">VITE_GOOGLE_MAPS_API_KEY</code> in{' '}
            <code className="bg-gray-100 px-1 rounded">.env.local</code>.
          </>
        ) : (
          <>Couldn't load the map ({loadError}).</>
        )}{' '}
        <a href={externalMapUrl} target="_blank" rel="noreferrer" className="underline">
          Open location in Google Maps
        </a>{' '}
        instead.
      </div>
    )
  }

  return (
    <div>
      <div ref={mapRef} className="w-full h-64 rounded-xl overflow-hidden border border-gray-200" />
      <a
        href={externalMapUrl}
        target="_blank"
        rel="noreferrer"
        className="text-xs text-gray-500 underline mt-1 inline-block"
      >
        Open in Google Maps
      </a>
    </div>
  )
}
