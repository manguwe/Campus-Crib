// Campus Crib — Send a real OS-level push notification
//
// Deploy with: supabase functions deploy send-push-notification --no-verify-jwt
// (--no-verify-jwt because this is only ever invoked by the
// notifications_push_on_insert Postgres trigger via pg_net, authenticated
// with the service role key directly in its Authorization header, not a
// user JWT - Supabase's default JWT verification would reject that.)
//
// Requires secrets set in the Supabase dashboard under Edge Functions ->
// Secrets:
//   VAPID_PUBLIC_KEY  - see this response for the generated value
//   VAPID_PRIVATE_KEY - see this response for the generated value
//   VAPID_SUBJECT     - a mailto: address or site URL, e.g.
//                       mailto:campuscribassociates@gmail.com (required
//                       by the Web Push protocol to identify the sender)
//
// Looks up every push_subscriptions row for the given user_id and sends
// to each. An expired/invalid subscription (404/410 from the push
// service) is deleted so it stops being retried forever; any other
// per-subscription error is just logged, never treated as fatal for the
// whole request - and neither ever propagates back to block whatever
// action triggered the notification in the first place (the calling
// trigger already swallows this function's own errors too, so this is
// a second, independent layer of the same "never block the real
// action" defensiveness).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import webpush from 'npm:web-push@3.6.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405)

  const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')
  const vapidSubject = Deno.env.get('VAPID_SUBJECT')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
    console.error('[send-push-notification] Missing VAPID secrets - push not configured yet.')
    // Not a hard error: the calling trigger doesn't care about the
    // response body, it just needs this to not throw.
    return jsonResponse({ skipped: true, reason: 'not configured' })
  }

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)

  let input
  try {
    input = await req.json()
  } catch {
    return jsonResponse({ error: 'Invalid request body.' }, 400)
  }

  const { user_id, title, body, url } = input || {}
  if (!user_id) return jsonResponse({ error: 'Missing user_id.' }, 400)

  const adminClient = createClient(supabaseUrl, serviceRoleKey)

  const { data: subscriptions, error: fetchError } = await adminClient
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth_key')
    .eq('user_id', user_id)

  if (fetchError) {
    console.error('[send-push-notification] Could not load subscriptions:', fetchError)
    return jsonResponse({ error: 'Could not load subscriptions.' }, 500)
  }

  if (!subscriptions || subscriptions.length === 0) {
    return jsonResponse({ sent: 0, reason: 'no subscriptions for this user' })
  }

  const payload = JSON.stringify({
    title: title || 'Campus Crib',
    body: body || '',
    url: url || '/',
    icon: '/icon-192.png',
  })

  let sent = 0
  let removed = 0

  for (const sub of subscriptions) {
    const pushSubscription = {
      endpoint: sub.endpoint,
      keys: { p256dh: sub.p256dh, auth: sub.auth_key },
    }

    try {
      await webpush.sendNotification(pushSubscription, payload)
      sent++
    } catch (err) {
      const statusCode = err?.statusCode
      if (statusCode === 404 || statusCode === 410) {
        // Subscription no longer valid (browser unsubscribed, device
        // reset, etc.) - clean it up so it isn't retried forever.
        await adminClient.from('push_subscriptions').delete().eq('id', sub.id)
        removed++
      } else {
        // Any other error (rate limit, transient network issue) is
        // just logged - not fatal for the other subscriptions in this
        // batch, and never propagates back to the caller as a failure.
        console.error('[send-push-notification] Send failed for subscription', sub.id, statusCode, err?.body || err?.message)
      }
    }
  }

  return jsonResponse({ sent, removed, total: subscriptions.length })
})
