import { supabase } from './supabaseClient'

const PRIVATE_MARKER = 'ikfile:'

async function callMediaFunction(formData) {
  const { data, error } = await supabase.functions.invoke('imagekit-media', { body: formData })
  if (error) throw error
  if (data?.error) throw new Error(data.error)
  return data
}

// Longest side in pixels and JPEG quality used when shrinking photos before upload.
// Property photos are shrunk harder; ID documents and payment receipts keep more detail so text stays readable.
const COMPRESSION = {
  'property-media': { maxSide: 1600, quality: 0.8 },
  'landlord-document': { maxSide: 2000, quality: 0.85 },
  'payment-proof': { maxSide: 2000, quality: 0.85 },
}

// Shrinks a photo in the browser. Videos, PDFs, GIFs and anything it cannot read are returned unchanged.
// If the result would not be smaller, the original file is kept.
async function compressImage(file, { maxSide, quality } = { maxSide: 1600, quality: 0.8 }) {
  const type = file?.type || ''
  if (!type.startsWith('image/') || type === 'image/gif' || type === 'image/svg+xml') return file
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff' // JPEG has no transparency
    ctx.fillRect(0, 0, width, height)
    ctx.drawImage(bitmap, 0, 0, width, height)
    if (bitmap.close) bitmap.close()
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
    if (!blob || blob.size >= file.size) return file
    const name = (file.name || 'photo').replace(/\.[^.]+$/, '') + '.jpg'
    return new File([blob], name, { type: 'image/jpeg' })
  } catch {
    return file
  }
}

async function upload(file, purpose, { propertyId } = {}) {
  const prepared = await compressImage(file, COMPRESSION[purpose])
  const body = new FormData()
  body.append('action', 'upload')
  body.append('purpose', purpose)
  if (propertyId) body.append('propertyId', propertyId)
  body.append('file', prepared, prepared.name)
  return callMediaFunction(body)
}

export async function uploadIdDocument(file) {
  const result = await upload(file, 'landlord-document')
  return result.reference
}

export async function uploadLandlordDocument(file) {
  const result = await upload(file, 'landlord-document')
  return result.reference
}

export async function getIdDocumentSignedUrl(reference, expiresInSeconds = 300) {
  if (!reference?.startsWith(PRIVATE_MARKER)) {
    const { data, error } = await supabase.storage.from('landlord-documents').createSignedUrl(reference, expiresInSeconds)
    if (error) throw error
    return data.signedUrl
  }
  const body = new FormData()
  body.append('action', 'view')
  body.append('purpose', 'landlord-document')
  body.append('reference', reference)
  const result = await callMediaFunction(body)
  return result.url
}

export async function discardPrivateUpload(reference, purpose) {
  if (!reference?.startsWith(PRIVATE_MARKER)) return
  const body = new FormData()
  body.append('action', 'discard-private-upload')
  body.append('purpose', purpose)
  body.append('reference', reference)
  await callMediaFunction(body)
}

export async function getPaymentProofSignedUrl(reference) {
  if (!reference?.startsWith(PRIVATE_MARKER)) {
    const { data, error } = await supabase.storage.from('payment-proofs').createSignedUrl(reference, 600)
    if (error) throw error
    return data.signedUrl
  }
  const body = new FormData()
  body.append('action', 'view')
  body.append('purpose', 'payment-proof')
  body.append('reference', reference)
  const result = await callMediaFunction(body)
  return result.url
}

export async function uploadPaymentProof(file, propertyId) {
  const result = await upload(file, 'payment-proof', { propertyId })
  return result.reference
}

export async function uploadPropertyMediaFile(file, landlordId, propertyId) {
  const result = await upload(file, 'property-media', { propertyId })
  return { url: result.url, fileId: result.fileId }
}

export async function deletePropertyMediaFile(item) {
  if (item?.storage_file_id) {
    const body = new FormData()
    body.append('action', 'delete-property-media')
    body.append('mediaId', item.id)
    return callMediaFunction(body)
  }
  const publicUrl = typeof item === 'string' ? item : item?.url
  const marker = '/object/public/property-media/'
  const idx = publicUrl?.indexOf(marker) ?? -1
  if (idx === -1) return
  const path = decodeURIComponent(publicUrl.slice(idx + marker.length))
  const { error } = await supabase.storage.from('property-media').remove([path])
  if (error) throw error
}
