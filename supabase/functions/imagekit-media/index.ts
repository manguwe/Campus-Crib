// Media server for Campus Crib. (The folder name is historical: files now live in Cloudflare R2.)
//   * Public photos and videos  -> R2 bucket "campus-crib-media", served by the public Worker.
//   * Private documents         -> R2 bucket "campus-crib-private", never public. Opened only through 5-minute signed links.
//   * Old ImageKit private references ("ikfile:...") can still be opened until they have all been moved.
// Secrets needed: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, MEDIA_BASE_URL
// Optional secrets: R2_MEDIA_BUCKET (default campus-crib-media), R2_PRIVATE_BUCKET (default campus-crib-private)
// Only for old ImageKit references: IMAGEKIT_PRIVATE_KEY, IMAGEKIT_URL_ENDPOINT
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { AwsClient } from 'npm:aws4fetch@^1.0.17'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const R2_MARKER = 'r2file:'
const IK_MARKER = 'ikfile:'

// folder (inside the private bucket) for each upload purpose
const PRIVATE_FOLDERS: Record<string, string> = {
  'landlord-document': 'landlord-documents',
  'payment-proof': 'payment-proofs',
  'agent-payment-proof': 'agent-payments',
  'reservation-proof': 'reservation-proofs',
}

async function sha1Hex(secret: string, message: string) {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'])
  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(message))
  return [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const auth = req.headers.get('Authorization') || ''
  if (!auth.startsWith('Bearer ')) return json({ error: 'Sign in required' }, 401)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } })
  const { data: { user }, error: authError } = await userClient.auth.getUser()
  if (authError || !user) return json({ error: 'Invalid session' }, 401)
  const { data: profile } = await userClient.from('profiles').select('role').eq('id', user.id).maybeSingle()
  const role = profile?.role

  // ---- R2 -------------------------------------------------------------------------------------
  const accountId = Deno.env.get('R2_ACCOUNT_ID')
  const accessKeyId = Deno.env.get('R2_ACCESS_KEY_ID')
  const secretAccessKey = Deno.env.get('R2_SECRET_ACCESS_KEY')
  const mediaBase = (Deno.env.get('MEDIA_BASE_URL') || '').replace(/\/$/, '')
  const mediaBucket = Deno.env.get('R2_MEDIA_BUCKET') || 'campus-crib-media'
  const privateBucket = Deno.env.get('R2_PRIVATE_BUCKET') || 'campus-crib-private'
  if (!accountId || !accessKeyId || !secretAccessKey || !mediaBase) return json({ error: 'Storage server configuration is incomplete' }, 503)

  const aws = new AwsClient({ accessKeyId, secretAccessKey, service: 's3', region: 'auto' })
  const r2Url = (bucket: string, key: string) =>
    `https://${accountId}.r2.cloudflarestorage.com/${bucket}/${key.split('/').map(encodeURIComponent).join('/')}`
  const r2Put = async (bucket: string, key: string, bytes: Uint8Array, contentType: string, cacheControl: string) => {
    const res = await aws.fetch(r2Url(bucket, key), { method: 'PUT', headers: { 'Content-Type': contentType, 'Cache-Control': cacheControl }, body: bytes })
    if (!res.ok) throw new Error(`R2 upload failed: HTTP ${res.status}`)
  }
  const r2Delete = async (bucket: string, key: string) => {
    const res = await aws.fetch(r2Url(bucket, key), { method: 'DELETE' })
    if (!res.ok && res.status !== 404) throw new Error(`R2 delete failed: HTTP ${res.status}`)
  }
  const r2SignedGet = async (bucket: string, key: string, seconds = 300) => {
    const signed = await aws.sign(`${r2Url(bucket, key)}?X-Amz-Expires=${seconds}`, { method: 'GET', aws: { signQuery: true } })
    return signed.url
  }

  // ---- ImageKit (only to open or clean up old references) -------------------------------------------
  const ikPrivateKey = Deno.env.get('IMAGEKIT_PRIVATE_KEY')
  const ikEndpoint = Deno.env.get('IMAGEKIT_URL_ENDPOINT')?.replace(/\/$/, '')
  const ikAuth = ikPrivateKey ? 'Basic ' + btoa(`${ikPrivateKey}:`) : ''

  try {
    const body = await req.formData()
    const action = String(body.get('action') || 'upload')

    // ---------------------------------------------------------------- upload
    if (action === 'upload') {
      const file = body.get('file')
      const purpose = String(body.get('purpose') || '')
      const propertyId = String(body.get('propertyId') || '')
      if (!(file instanceof File)) return json({ error: 'File is required' }, 400)
      if (file.size <= 0 || file.size > 25 * 1024 * 1024) return json({ error: 'File must be between 1 byte and 25 MB' }, 413)
      const isImage = file.type.startsWith('image/')
      const isVideo = file.type.startsWith('video/')
      const isPdf = file.type === 'application/pdf'
      let prefix = '' // folder path inside the bucket
      let isPublic = false

      if (purpose === 'property-media') {
        if (role !== 'landlord' || !propertyId || (!isImage && !isVideo)) return json({ error: 'Not allowed for this upload' }, 403)
        const { data: property } = await userClient.from('properties').select('id, landlord_id').eq('id', propertyId).eq('landlord_id', user.id).maybeSingle()
        if (!property) return json({ error: 'You do not own this listing' }, 403)
        prefix = `property-media/${user.id}/${propertyId}`
        isPublic = true
      } else if (purpose === 'landlord-document') {
        if (role !== 'landlord' || (!isImage && !isPdf)) return json({ error: 'Not allowed for this upload' }, 403)
        prefix = `${PRIVATE_FOLDERS[purpose]}/${user.id}`
      } else if (purpose === 'payment-proof') {
        if (role !== 'student' || (!isImage && !isPdf) || !propertyId) return json({ error: 'Not allowed for this upload' }, 403)
        const { data: property } = await userClient.from('properties').select('id').eq('id', propertyId).eq('status', 'approved').maybeSingle()
        if (!property) return json({ error: 'Listing is unavailable' }, 403)
        prefix = `${PRIVATE_FOLDERS[purpose]}/${user.id}/${propertyId}`
      } else if (purpose === 'agent-payment-proof') {
        if (role !== 'landlord' || (!isImage && !isPdf)) return json({ error: 'Not allowed for this upload' }, 403)
        const { data: agent } = await userClient.from('agent_profiles').select('id').eq('id', user.id).maybeSingle()
        if (!agent) return json({ error: 'Only agents can upload this' }, 403)
        prefix = `${PRIVATE_FOLDERS[purpose]}/${user.id}`
      } else if (purpose === 'reservation-proof') {
        if (role !== 'student' || (!isImage && !isPdf)) return json({ error: 'Not allowed for this upload' }, 403)
        const { data: due } = await userClient
          .from('reservations')
          .select('id')
          .eq('student_id', user.id)
          .in('payment_status', ['awaiting_payment', 'rejected'])
          .limit(1)
        if (!due?.length) return json({ error: 'No reservation payment is due' }, 403)
        prefix = `${PRIVATE_FOLDERS[purpose]}/${user.id}`
      } else return json({ error: 'Unknown upload purpose' }, 400)

      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120) || 'upload.bin'
      const key = `${prefix}/${crypto.randomUUID()}-${safeName}`
      const bytes = new Uint8Array(await file.arrayBuffer())
      const contentType = file.type || 'application/octet-stream'
      try {
        if (isPublic) await r2Put(mediaBucket, key, bytes, contentType, 'public, max-age=31536000, immutable')
        else await r2Put(privateBucket, key, bytes, contentType, 'private, no-store')
      } catch (e) {
        console.error('upload failed', e)
        return json({ error: 'Storage upload failed' }, 502)
      }
      return json({
        url: isPublic ? `${mediaBase}/${key}` : null,
        fileId: key,
        filePath: key,
        reference: isPublic ? null : `${R2_MARKER}${key}`,
      })
    }

    // ------------------------------------------- clean up an upload when the database save failed
    if (action === 'discard-property-media') {
      if (role !== 'landlord') return json({ error: 'Not allowed' }, 403)
      const key = String(body.get('fileId') || '')
      if (!key.startsWith(`property-media/${user.id}/`) || key.includes('..')) return json({ error: 'Upload ownership could not be verified' }, 403)
      await r2Delete(mediaBucket, key)
      return json({ success: true })
    }

    if (action === 'discard-private-upload') {
      const reference = String(body.get('reference') || '')
      const purpose = String(body.get('purpose') || '')
      if (!PRIVATE_FOLDERS[purpose]) return json({ error: 'Invalid cleanup purpose' }, 400)
      if ((purpose === 'landlord-document' && role !== 'landlord') || (purpose === 'agent-payment-proof' && role !== 'landlord') || ((purpose === 'payment-proof' || purpose === 'reservation-proof') && role !== 'student')) return json({ error: 'Not allowed' }, 403)

      if (reference.startsWith(R2_MARKER)) {
        const key = reference.slice(R2_MARKER.length)
        if (!key.startsWith(`${PRIVATE_FOLDERS[purpose]}/${user.id}/`) || key.includes('..')) return json({ error: 'Upload ownership could not be verified' }, 403)
        await r2Delete(privateBucket, key)
        return json({ success: true })
      }

      if (reference.startsWith(IK_MARKER) && ikAuth) {
        const fileId = reference.slice(IK_MARKER.length)
        const metaResponse = await fetch(`https://api.imagekit.io/v1/files/${encodeURIComponent(fileId)}/details`, { headers: { Authorization: ikAuth } })
        const meta = await metaResponse.json()
        const expectedPrefix = `/campus-crib/private/${PRIVATE_FOLDERS[purpose]}/${user.id}/`
        if (!metaResponse.ok || !String(meta.filePath || '').startsWith(expectedPrefix)) return json({ error: 'Upload ownership could not be verified' }, 403)
        const deleted = await fetch(`https://api.imagekit.io/v1/files/${encodeURIComponent(fileId)}`, { method: 'DELETE', headers: { Authorization: ikAuth } })
        if (!deleted.ok && deleted.status !== 404) return json({ error: 'Could not clean up uploaded file' }, 502)
        return json({ success: true })
      }
      return json({ error: 'Unsupported media reference' }, 400)
    }

    // ------------------------------------------------------------ delete a listing photo or video
    if (action === 'delete-property-media') {
      if (role !== 'landlord') return json({ error: 'Only landlords can remove listing media' }, 403)
      const mediaId = String(body.get('mediaId') || '')
      const { data: media } = await userClient.from('property_media').select('id, property_id, url, storage_file_id').eq('id', mediaId).maybeSingle()
      if (!media) return json({ error: 'Media record not found' }, 404)
      const { data: property } = await userClient.from('properties').select('id').eq('id', media.property_id).eq('landlord_id', user.id).maybeSingle()
      if (!property) return json({ error: 'You do not own this listing' }, 403)

      // Work out where the file lives: an R2 key, or (old files) an ImageKit file id
      let key: string | null = null
      if (media.storage_file_id?.startsWith('property-media/')) key = media.storage_file_id
      else if (media.url?.startsWith(`${mediaBase}/`)) key = decodeURIComponent(media.url.slice(mediaBase.length + 1))

      if (key) {
        // Only ever delete inside this listing's own folder
        if (!key.startsWith(`property-media/${user.id}/${media.property_id}/`) || key.includes('..')) return json({ error: 'File location could not be verified' }, 403)
        await r2Delete(mediaBucket, key)
      } else if (media.storage_file_id && ikAuth) {
        const deleteAsset = await fetch(`https://api.imagekit.io/v1/files/${encodeURIComponent(media.storage_file_id)}`, { method: 'DELETE', headers: { Authorization: ikAuth } })
        if (!deleteAsset.ok && deleteAsset.status !== 404) return json({ error: 'Could not remove the old file' }, 502)
      } else return json({ error: 'Media file could not be located' }, 404)

      const { error: rowError } = await userClient.from('property_media').delete().eq('id', media.id)
      if (rowError) return json({ error: 'File removed but database row cleanup failed; contact support' }, 500)
      return json({ success: true })
    }

    // ------------------------------------------------------------ open a private document
    if (action === 'view') {
      const reference = String(body.get('reference') || '')
      const purpose = String(body.get('purpose') || '')
      const isR2 = reference.startsWith(R2_MARKER)
      const isIk = reference.startsWith(IK_MARKER)
      if (!isR2 && !isIk) return json({ error: 'Unsupported media reference' }, 400)

      let allowed = false
      if (purpose === 'landlord-document') {
        if (role === 'admin') {
          const { data } = await userClient.from('landlord_profiles').select('id').or(`id_document_url.eq.${reference},id_document_front_url.eq.${reference},id_document_back_url.eq.${reference},proof_of_ownership_url.eq.${reference}`).limit(1)
          allowed = Boolean(data?.length)
        } else if (role === 'landlord') {
          const { data } = await userClient.from('landlord_profiles').select('id').eq('id', user.id).or(`id_document_url.eq.${reference},id_document_front_url.eq.${reference},id_document_back_url.eq.${reference},proof_of_ownership_url.eq.${reference}`).maybeSingle()
          allowed = Boolean(data)
        }
      } else if (purpose === 'payment-proof' && role === 'admin') {
        const { data } = await userClient.from('property_access_requests').select('id').eq('proof_path', reference).limit(1)
        allowed = Boolean(data?.length)
      } else if (purpose === 'reservation-proof' && role === 'admin') {
        const { data } = await userClient.from('reservations').select('id').eq('payment_proof_path', reference).limit(1)
        allowed = Boolean(data?.length)
      } else if (purpose === 'agent-payment-proof' && role === 'admin') {
        const { data } = await userClient.from('agent_payments').select('id').eq('proof_path', reference).limit(1)
        allowed = Boolean(data?.length)
      }
      if (!allowed) return json({ error: 'You are not authorized to view this file' }, 403)

      if (isR2) {
        const key = reference.slice(R2_MARKER.length)
        if (key.includes('..')) return json({ error: 'Private file not found' }, 404)
        return json({ url: await r2SignedGet(privateBucket, key, 300) })
      }

      // old ImageKit reference
      if (!ikAuth || !ikEndpoint || !ikPrivateKey) return json({ error: 'Old file storage is no longer available' }, 503)
      const fileId = reference.slice(IK_MARKER.length)
      const metaResponse = await fetch(`https://api.imagekit.io/v1/files/${encodeURIComponent(fileId)}/details`, { headers: { Authorization: ikAuth } })
      const meta = await metaResponse.json()
      if (!metaResponse.ok || !meta.filePath) return json({ error: 'Private file not found' }, 404)
      const expiry = Math.floor(Date.now() / 1000) + 300
      const path = String(meta.filePath).startsWith('/') ? String(meta.filePath) : `/${meta.filePath}`
      // ImageKit signs the path relative to the URL endpoint WITHOUT a leading slash, followed by the expiry timestamp.
      const signature = await sha1Hex(ikPrivateKey, `${path.replace(/^\//, '')}${expiry}`)
      return json({ url: `${ikEndpoint}${path}?ik-t=${expiry}&ik-s=${signature}` })
    }

    return json({ error: 'Unknown action' }, 400)
  } catch (error) {
    console.error('media function error', error)
    return json({ error: 'Media operation failed' }, 500)
  }
})
