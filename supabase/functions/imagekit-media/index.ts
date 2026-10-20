import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
const marker = 'ikfile:'

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

  const privateKey = Deno.env.get('IMAGEKIT_PRIVATE_KEY')
  const endpoint = Deno.env.get('IMAGEKIT_URL_ENDPOINT')?.replace(/\/$/, '')
  if (!privateKey || !endpoint) return json({ error: 'ImageKit server configuration is incomplete' }, 503)
  const imageKitAuth = 'Basic ' + btoa(`${privateKey}:`)

  try {
    const body = await req.formData()
    const action = String(body.get('action') || 'upload')

    if (action === 'upload') {
      const file = body.get('file')
      const purpose = String(body.get('purpose') || '')
      const propertyId = String(body.get('propertyId') || '')
      if (!(file instanceof File)) return json({ error: 'File is required' }, 400)
      if (file.size <= 0 || file.size > 25 * 1024 * 1024) return json({ error: 'File must be between 1 byte and 25 MB' }, 413)
      const isImage = file.type.startsWith('image/')
      const isVideo = file.type.startsWith('video/')
      const isPdf = file.type === 'application/pdf'
      let folder = ''
      let isPrivateFile = true

      if (purpose === 'property-media') {
        if (role !== 'landlord' || !propertyId || (!isImage && !isVideo)) return json({ error: 'Not allowed for this upload' }, 403)
        const { data: property } = await userClient.from('properties').select('id, landlord_id').eq('id', propertyId).eq('landlord_id', user.id).maybeSingle()
        if (!property) return json({ error: 'You do not own this listing' }, 403)
        folder = `/campus-crib/property-media/${user.id}/${propertyId}`
        isPrivateFile = false
      } else if (purpose === 'landlord-document') {
        if (role !== 'landlord' || (!isImage && !isPdf)) return json({ error: 'Not allowed for this upload' }, 403)
        folder = `/campus-crib/private/landlord-documents/${user.id}`
      } else if (purpose === 'payment-proof') {
        if (role !== 'student' || (!isImage && !isPdf) || !propertyId) return json({ error: 'Not allowed for this upload' }, 403)
        const { data: property } = await userClient.from('properties').select('id').eq('id', propertyId).eq('status', 'approved').maybeSingle()
        if (!property) return json({ error: 'Listing is unavailable' }, 403)
        folder = `/campus-crib/private/payment-proofs/${user.id}/${propertyId}`
      } else if (purpose === 'agent-payment-proof') {
        if (role !== 'landlord' || (!isImage && !isPdf)) return json({ error: 'Not allowed for this upload' }, 403)
        const { data: agent } = await userClient.from('agent_profiles').select('id').eq('id', user.id).maybeSingle()
        if (!agent) return json({ error: 'Only agents can upload this' }, 403)
        folder = `/campus-crib/private/agent-payments/${user.id}`
      } else if (purpose === 'reservation-proof') {
        if (role !== 'student' || (!isImage && !isPdf)) return json({ error: 'Not allowed for this upload' }, 403)
        const { data: due } = await userClient
          .from('reservations')
          .select('id')
          .eq('student_id', user.id)
          .in('payment_status', ['awaiting_payment', 'rejected'])
          .limit(1)
        if (!due?.length) return json({ error: 'No reservation payment is due' }, 403)
        folder = `/campus-crib/private/reservation-proofs/${user.id}`
      } else return json({ error: 'Unknown upload purpose' }, 400)

      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120) || 'upload.bin'
      const upload = new FormData()
      upload.append('file', file, safeName)
      upload.append('fileName', `${crypto.randomUUID()}-${safeName}`)
      upload.append('folder', folder)
      upload.append('useUniqueFileName', 'false')
      upload.append('isPrivateFile', String(isPrivateFile))
      const response = await fetch('https://upload.imagekit.io/api/v1/files/upload', { method: 'POST', headers: { Authorization: imageKitAuth }, body: upload })
      const result = await response.json()
      if (!response.ok) return json({ error: 'ImageKit upload failed', detail: result?.message || `HTTP ${response.status}` }, 502)
      return json({ url: result.url, fileId: result.fileId, filePath: result.filePath, reference: isPrivateFile ? `${marker}${result.fileId}` : null })
    }

    if (action === 'discard-private-upload') {
      const reference = String(body.get('reference') || '')
      const purpose = String(body.get('purpose') || '')
      if (!reference.startsWith(marker)) return json({ error: 'Unsupported media reference' }, 400)
      if ((purpose === 'landlord-document' && role !== 'landlord') || (purpose === 'agent-payment-proof' && role !== 'landlord') || ((purpose === 'payment-proof' || purpose === 'reservation-proof') && role !== 'student')) return json({ error: 'Not allowed' }, 403)
      if (!['landlord-document', 'payment-proof', 'agent-payment-proof', 'reservation-proof'].includes(purpose)) return json({ error: 'Invalid cleanup purpose' }, 400)
      const fileId = reference.slice(marker.length)
      const metaResponse = await fetch(`https://api.imagekit.io/v1/files/${encodeURIComponent(fileId)}/details`, { headers: { Authorization: imageKitAuth } })
      const meta = await metaResponse.json()
      const expectedPrefix = purpose === 'landlord-document'
        ? `/campus-crib/private/landlord-documents/${user.id}/`
        : purpose === 'agent-payment-proof'
          ? `/campus-crib/private/agent-payments/${user.id}/`
          : purpose === 'reservation-proof'
            ? `/campus-crib/private/reservation-proofs/${user.id}/`
            : `/campus-crib/private/payment-proofs/${user.id}/`
      if (!metaResponse.ok || !String(meta.filePath || '').startsWith(expectedPrefix)) return json({ error: 'Upload ownership could not be verified' }, 403)
      const deleted = await fetch(`https://api.imagekit.io/v1/files/${encodeURIComponent(fileId)}`, { method: 'DELETE', headers: { Authorization: imageKitAuth } })
      if (!deleted.ok && deleted.status !== 404) return json({ error: 'Could not clean up uploaded file' }, 502)
      return json({ success: true })
    }

    if (action === 'delete-property-media') {
      if (role !== 'landlord') return json({ error: 'Only landlords can remove listing media' }, 403)
      const mediaId = String(body.get('mediaId') || '')
      const { data: media } = await userClient.from('property_media').select('id, property_id, storage_file_id').eq('id', mediaId).maybeSingle()
      if (!media?.storage_file_id) return json({ error: 'ImageKit media record not found' }, 404)
      const { data: property } = await userClient.from('properties').select('id').eq('id', media.property_id).eq('landlord_id', user.id).maybeSingle()
      if (!property) return json({ error: 'You do not own this listing' }, 403)
      const deleteAsset = await fetch(`https://api.imagekit.io/v1/files/${encodeURIComponent(media.storage_file_id)}`, { method: 'DELETE', headers: { Authorization: imageKitAuth } })
      if (!deleteAsset.ok && deleteAsset.status !== 404) return json({ error: 'Could not remove ImageKit asset' }, 502)
      const { error: rowError } = await userClient.from('property_media').delete().eq('id', media.id)
      if (rowError) return json({ error: 'Asset removed but database row cleanup failed; contact support' }, 500)
      return json({ success: true })
    }

    if (action === 'view') {
      const reference = String(body.get('reference') || '')
      const purpose = String(body.get('purpose') || '')
      if (!reference.startsWith(marker)) return json({ error: 'Unsupported media reference' }, 400)
      const fileId = reference.slice(marker.length)
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

      const metaResponse = await fetch(`https://api.imagekit.io/v1/files/${encodeURIComponent(fileId)}/details`, { headers: { Authorization: imageKitAuth } })
      const meta = await metaResponse.json()
      if (!metaResponse.ok || !meta.filePath) return json({ error: 'Private file not found' }, 404)
      const expiry = Math.floor(Date.now() / 1000) + 300
      const path = String(meta.filePath).startsWith('/') ? String(meta.filePath) : `/${meta.filePath}`
      const unsignedUrl = `${endpoint}${path}`
      // ImageKit signs the path relative to the URL endpoint WITHOUT a leading slash, followed by the expiry timestamp.
      const signature = await sha1Hex(privateKey, `${path.replace(/^\//, '')}${expiry}`)
      return json({ url: `${unsignedUrl}?ik-t=${expiry}&ik-s=${signature}` })
    }

    return json({ error: 'Unknown action' }, 400)
  } catch (error) {
    console.error('imagekit-media error', error)
    return json({ error: 'Media operation failed' }, 500)
  }
})
