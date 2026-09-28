# Campus Crib V15 — reservation landlord contact + PWA/iPhone compatibility

## What changed

- Admin reservation records now resolve the landlord through the listing's `landlord_id`.
- Admins can see the landlord's registered name, phone and email on the reservation.
- Admins get direct Call Landlord / Email Landlord actions where those contacts exist.
- Reservation history also shows the landlord attached to the listing.
- iOS push detection now uses feature detection instead of parsing iOS versions, which also handles iPadOS devices that identify as Macintosh.
- Added `mobile-web-app-capable` metadata.
- Added manifest `id` and `scope`.
- Added an install prompt for supported browsers and an iPhone/iPad installation guide.
- Service-worker registration explicitly uses `/` scope and disables stale service-worker caching.
- Vercel sends `no-cache` headers for `sw.js` and `manifest.json` so PWA updates propagate more reliably.

## No new Supabase migration is required for the reservation landlord display.

V15 uses the existing `get_admin_user_directory()` RPC from V12. Make sure the V12 SQL migration has already been run.

## iPhone / iPad requirements

For an iPhone/iPad:

1. Open Campus Crib in Safari.
2. Tap Share.
3. Tap Add to Home Screen.
4. Turn on Open as Web App.
5. Tap Add.
6. Launch Campus Crib from the new Home Screen icon.

Web Push on iPhone/iPad requires a Home Screen web app and iOS/iPadOS 16.4 or newer.

## Push notification backend checklist

Client-side installation alone is not enough for closed-app notifications. Verify all of these:

1. VAPID public key is present in the Vercel frontend environment as `VITE_VAPID_PUBLIC_KEY`.
2. `send-push-notification` Edge Function is deployed.
3. Edge Function secrets exist:
   - `VAPID_PUBLIC_KEY`
   - `VAPID_PRIVATE_KEY`
   - `VAPID_SUBJECT`
4. `supabase_sql/27_push_notifications.sql` has been run.
5. The database settings required by that migration are configured:
   - `app.settings.supabase_url`
   - `app.settings.service_role_key`
6. `supabase_sql/34_chat_calls_notifications.sql` has also been run, since it updates the push dispatcher for chat/call notification targets.

If any of the backend items above is missing, in-app notifications can still work while OS-level push notifications fail.

## Build

```bash
npm install
npm run build
```
