import { supabase } from './supabaseClient'

function uniqueFilename(file) {
  const ext = file.name.includes('.') ? file.name.split('.').pop() : 'bin'
  const random = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)
  return `${Date.now()}-${random}.${ext}`
}

// ---------------------------------------------------------------------
// landlord-documents (private bucket)
// ---------------------------------------------------------------------

/**
 * Uploads an ID document to the private landlord-documents bucket under
 * the landlord's own folder. Returns the storage PATH (not a public URL -
 * the bucket is private, so a plain URL wouldn't work). Store this path
 * in landlord_profiles.id_document_url; use getIdDocumentSignedUrl() to
 * actually view/download it later.
 */
export async function uploadIdDocument(file, userId) {
  const path = `${userId}/${uniqueFilename(file)}`
  const { error } = await supabase.storage
    .from('landlord-documents')
    .upload(path, file, { upsert: false, cacheControl: '3600' })
  if (error) throw error
  return path
}

/** Creates a short-lived signed URL to view a private ID document. */
export async function getIdDocumentSignedUrl(path, expiresInSeconds = 300) {
  const { data, error } = await supabase.storage
    .from('landlord-documents')
    .createSignedUrl(path, expiresInSeconds)
  if (error) throw error
  return data.signedUrl
}

// ---------------------------------------------------------------------
// property-media (public bucket)
// ---------------------------------------------------------------------

/**
 * Uploads one image/video to the public property-media bucket under
 * {landlordId}/{propertyId}/..., and returns its permanent public URL -
 * this is what gets stored directly in property_media.url.
 */
export async function uploadPropertyMediaFile(file, landlordId, propertyId) {
  const path = `${landlordId}/${propertyId}/${uniqueFilename(file)}`
  const { error } = await supabase.storage
    .from('property-media')
    .upload(path, file, { upsert: false, cacheControl: '3600' })
  if (error) throw error

  const { data } = supabase.storage.from('property-media').getPublicUrl(path)
  return data.publicUrl
}

/** Deletes a property-media file given its stored public URL. */
export async function deletePropertyMediaFile(publicUrl) {
  const marker = '/object/public/property-media/'
  const idx = publicUrl.indexOf(marker)
  if (idx === -1) return // not a recognizable path in this bucket - nothing to do
  const path = decodeURIComponent(publicUrl.slice(idx + marker.length))
  const { error } = await supabase.storage.from('property-media').remove([path])
  if (error) throw error
}
