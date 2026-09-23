import { useEffect, useRef, useState } from 'react'
import { Camera, Trash2, UploadCloud, Expand } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { uploadPropertyMediaFile, deletePropertyMediaFile } from '../lib/storage'
import { formatSupabaseError } from '../lib/errorMessages'
import ErrorBanner from './ui/ErrorBanner'
import Spinner from './ui/Spinner'
import Lightbox from './Lightbox'

export default function PropertyMediaManager({ propertyId, landlordId }) {
  const [media, setMedia] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [lightboxIndex, setLightboxIndex] = useState(null)
  const fileInputRef = useRef(null)

  async function loadMedia() {
    setLoading(true)
    const { data, error } = await supabase
      .from('property_media')
      .select('id, media_type, url, sort_order')
      .eq('property_id', propertyId)
      .order('sort_order', { ascending: true })
    if (error) setError(formatSupabaseError(error, 'Could not load media.'))
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

    const oversized = files.find((f) => f.size > 25 * 1024 * 1024)
    if (oversized) {
      setError(`"${oversized.name}" is over 25MB — please use a smaller file.`)
      e.target.value = ''
      return
    }

    const invalidType = files.find((f) => !f.type.startsWith('image/') && !f.type.startsWith('video/'))
    if (invalidType) {
      setError(`"${invalidType.name}" isn't an image or video file.`)
      e.target.value = ''
      return
    }

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
      setError(formatSupabaseError(err, 'Could not upload that file. Please try a different one.'))
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
      setError(formatSupabaseError(err, 'Could not remove that file.'))
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <Camera size={15} className="text-accent" />
        <h3 className="font-medium text-gray-900">Photos & videos</h3>
      </div>
      <p className="text-xs text-gray-500 mb-3">
        Listings with a few clear photos get noticeably more interest from students.
      </p>

      <ErrorBanner message={error} className="mb-3" />

      {loading ? (
        <Spinner label="Loading media…" />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {media.map((item, i) => (
            <div
              key={item.id}
              className="group relative rounded-xl overflow-hidden border border-gray-200 bg-white shadow-sm"
            >
              <button
                type="button"
                onClick={() => setLightboxIndex(i)}
                className="block w-full h-28"
              >
                {item.media_type === 'video' ? (
                  <video src={item.url} className="w-full h-28 object-cover pointer-events-none" />
                ) : (
                  <img src={item.url} alt="" className="w-full h-28 object-cover" />
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                  <Expand
                    size={16}
                    className="text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  />
                </div>
              </button>
              <button
                type="button"
                onClick={() => handleDelete(item)}
                aria-label="Remove this file"
                className="absolute top-1.5 right-1.5 bg-white shadow-sm rounded-full p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}

          {/* Always-visible dropzone, even with 0-2 photos, so the section
              never reads as an empty dead end. */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex flex-col items-center justify-center gap-1 h-28 rounded-xl border-2 border-dashed border-gray-300 text-gray-400 hover:border-accent hover:text-accent transition-colors disabled:opacity-60"
          >
            {uploading ? (
              <Spinner label="Uploading…" />
            ) : (
              <>
                <UploadCloud size={20} />
                <span className="text-xs font-medium">Add photos/videos</span>
              </>
            )}
          </button>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        onChange={handleFilesSelected}
        disabled={uploading}
        className="hidden"
      />

      {lightboxIndex !== null && (
        <Lightbox items={media} initialIndex={lightboxIndex} onClose={() => setLightboxIndex(null)} />
      )}
    </div>
  )
}
