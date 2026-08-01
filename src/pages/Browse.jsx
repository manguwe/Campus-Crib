import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import PropertyCard from '../components/PropertyCard'

export default function Browse() {
  const [properties, setProperties] = useState([])
  const [thumbnails, setThumbnails] = useState({}) // property_id -> url
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError('')

      // No .eq('status', 'approved') needed - RLS already limits what an
      // anonymous/student visitor can see to approved rows (see
      // 02_policies.sql). Listing it explicitly here would just be
      // redundant, not the actual security boundary.
      const { data: props, error: propsError } = await supabase
        .from('properties')
        .select(
          'id, title, price, currency, room_type, building_type, occupancy, toilet_shared_by, walk_minutes_to_campus, created_at'
        )
        .order('created_at', { ascending: false })

      if (propsError) {
        setError(propsError.message)
        setLoading(false)
        return
      }

      setProperties(props)

      if (props.length > 0) {
        const { data: media } = await supabase
          .from('property_media')
          .select('property_id, url, sort_order, media_type')
          .in(
            'property_id',
            props.map((p) => p.id)
          )
          .eq('media_type', 'image')
          .order('sort_order', { ascending: true })

        const firstByProperty = {}
        for (const m of media || []) {
          if (!firstByProperty[m.property_id]) firstByProperty[m.property_id] = m.url
        }
        setThumbnails(firstByProperty)
      }

      setLoading(false)
    }

    load()
  }, [])

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Browse listings</h1>
      <p className="text-gray-500 mb-6">Approved boarding houses near campus.</p>

      {loading && <p className="text-gray-500">Loading…</p>}
      {error && <p className="text-red-600 text-sm">{error}</p>}

      {!loading && properties.length === 0 && (
        <p className="text-gray-400">No approved listings yet — check back soon.</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {properties.map((p) => (
          <PropertyCard key={p.id} property={p} thumbnailUrl={thumbnails[p.id]} />
        ))}
      </div>
    </div>
  )
}
