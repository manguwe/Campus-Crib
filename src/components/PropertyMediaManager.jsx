import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { uploadPropertyMediaFile, deletePropertyMediaFile } from '../lib/storage'

export default function PropertyMediaManager({ propertyId, landlordId }) {
  const [media, setMedia] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  async function loadMedia() {
    setLoading(true)
    const { data, error } = await supabase
      .from('property_media')
      .select('id, media_type, url, sort_order')
      .eq('property_id', propertyId)
      .order('sort_order', { ascending: true })
    if (error) setError(error.message)
    else setMedia(data)
    setLoading(false)
  }

  useEffect(() => {
    loadMedia()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId])

  async function handleFilesSelected(e) {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    setError('')
    setUploading(true)

    try {
      let nextSortOrder = media.length
      for (const file of files) {
        const isVideo = file.type.startsWith('video/')
        const url = await uploadPropertyMediaFile(file, landlordId, propertyId)

        const { error: insertError } = await supabase.from('property_media').insert({
          property_id: propertyId,
          media_type: isVideo ? 'video' : 'image',
          url,
          sort_order: nextSortOrder,
        })
        if (insertError) throw insertError
        nextSortOrder += 1
      }
      await loadMedia()
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
      e.target.value = '' // allow re-selecting the same file(s) later
    }
  }

  async function handleDelete(item) {
    if (!window.confirm('Remove this file?')) return
    setError('')
    try {
      await deletePropertyMediaFile(item.url)
      const { error: deleteError } = await supabase.from('property_media').delete().eq('id', item.id)
      if (deleteError) throw deleteError
      setMedia((prev) => prev.filter((m) => m.id !== item.id))
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div>
      <h3 className="font-medium text-gray-900 mb-2">Photos & videos</h3>

      <input
        type="file"
        accept="image/*,video/*"
        multiple
        onChange={handleFilesSelected}
        disabled={uploading}
        className="text-sm"
      />
      {uploading && <p className="text-sm text-gray-500 mt-1">Uploading…</p>}
      {error && <p className="text-sm text-red-600 mt-1">{error}</p>}

      {loading ? (
        <p className="text-sm text-gray-400 mt-3">Loading media…</p>
      ) : media.length === 0 ? (
        <p className="text-sm text-gray-400 mt-3">No photos or videos yet.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
          {media.map((item) => (
            <div key={item.id} className="relative rounded-lg overflow-hidden border border-gray-200">
              {item.media_type === 'video' ? (
                <video src={item.url} controls className="w-full h-28 object-cover" />
              ) : (
                <img src={item.url} alt="" className="w-full h-28 object-cover" />
              )}
              <button
                onClick={() => handleDelete(item)}
                className="absolute top-1 right-1 bg-white/90 rounded-full text-xs px-2 py-0.5 text-red-600 font-medium"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
