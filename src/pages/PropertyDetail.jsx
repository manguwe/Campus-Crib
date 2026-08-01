import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { AMENITY_OPTIONS } from '../lib/constants'
import { buildingTypeLabel, propertySummaryParts } from '../lib/propertyDisplay'

export default function PropertyDetail() {
  const { id } = useParams()
  const [property, setProperty] = useState(null)
  const [media, setMedia] = useState([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      // RLS returns this row only if it's approved, or the caller owns it
      // / is an admin - a pending listing's id just comes back empty for
      // anyone else, same as a bad id would.
      const { data, error } = await supabase.from('properties').select('*').eq('id', id).single()

      if (error || !data) {
        setNotFound(true)
        setLoading(false)
        return
      }

      setProperty(data)

      const { data: mediaRows } = await supabase
        .from('property_media')
        .select('id, media_type, url, sort_order')
        .eq('property_id', id)
        .order('sort_order', { ascending: true })

      setMedia(mediaRows || [])
      setLoading(false)
    }

    load()
  }, [id])

  if (loading) return <p className="text-center text-gray-500">Loading…</p>

  if (notFound) {
    return (
      <div className="max-w-lg mx-auto text-center">
        <p className="text-gray-600">That listing doesn't exist, or isn't published yet.</p>
        <Link to="/browse" className="text-sm font-medium text-gray-900 underline mt-2 inline-block">
          Back to listings
        </Link>
      </div>
    )
  }

  const summary = propertySummaryParts(property).join(' · ')
  const buildingLabel = buildingTypeLabel(property)
  const selectedAmenities = AMENITY_OPTIONS.filter((opt) => (property.amenities || []).includes(opt.value))

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <Link to="/browse" className="text-sm text-gray-500 underline">
          ← Back to listings
        </Link>
      </div>

      {media.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {media.map((m) => (
            <div key={m.id} className="rounded-xl overflow-hidden border border-gray-200">
              {m.media_type === 'video' ? (
                <video src={m.url} controls className="w-full h-40 object-cover" />
              ) : (
                <img src={m.url} alt={property.title} className="w-full h-40 object-cover" />
              )}
            </div>
          ))}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        {buildingLabel && (
          <span className="inline-block mb-2 text-xs font-medium text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">
            {buildingLabel}
          </span>
        )}
        <h1 className="text-2xl font-bold text-gray-900">{property.title}</h1>
        <p className="text-gray-500 mt-1">{summary}</p>
        <p className="text-lg font-semibold text-gray-900 mt-3">
          {property.currency} {Number(property.price).toLocaleString()} / month
        </p>

        {property.address_text && (
          <p className="text-sm text-gray-600 mt-3">📍 {property.address_text}</p>
        )}

        {property.description && (
          <p className="text-sm text-gray-700 mt-4 whitespace-pre-line">{property.description}</p>
        )}

        {selectedAmenities.length > 0 && (
          <div className="mt-5">
            <h2 className="text-sm font-medium text-gray-900 mb-2">Amenities</h2>
            <div className="flex flex-wrap gap-2">
              {selectedAmenities.map((a) => (
                <span
                  key={a.value}
                  className="text-xs text-gray-600 bg-gray-100 rounded-full px-2.5 py-1"
                >
                  {a.label}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
