# Campus Crib V8 — Messaging, Voice Calls & Notifications

## 1. Install and build

```bash
npm install
npm run build
```

## 2. Supabase migration

Run:

```text
supabase_sql/34_chat_calls_notifications.sql
```

This creates private conversations/messages, voice-call signaling, Realtime publication entries, and server-created notifications for new messages/calls.

## 3. What is protected

- Listing chat: student must have approved property access; landlord can chat with students who have access.
- Support chat: authenticated users can open a private conversation with the first Campus Crib admin account.
- Phone/exact coordinates remain behind the existing V6 access approval.
- Chat rows and call signaling are private to conversation/call participants.

## 4. Voice calls

Voice calls use browser WebRTC audio with public STUN servers. The app must be served over HTTPS (Vercel is fine) and the user must grant microphone permission.

For production reliability across restrictive mobile networks, add a TURN server later. STUN alone is not guaranteed to connect every NAT/network combination.

## 5. Browser notifications

The app already has a service worker and push subscription flow. V8 also adds live in-app notification popups and native browser notifications while the app is open.

For notifications when the app is closed, the existing V27 push setup still needs:

- `VITE_VAPID_PUBLIC_KEY` in the frontend environment
- the `send-push-notification` Supabase Edge Function deployed/configured
- the database settings described in `supabase_sql/27_push_notifications.sql`

If browser notification permission is already `denied`, the browser will not show the permission prompt again. The user must re-enable notifications for the site in browser/device settings.

## 6. User flow

### Student

`Approved listing -> Chat with this listing -> message landlord -> Call`

or

`Messages -> Chat with Campus Crib support -> message/call support for directions`

### Landlord

`Messages -> listing conversation -> chat/call approved-access student`

### Admin

Support conversations and notification records are available for moderation/support. A future admin communications screen can expose all support/listing conversations in one workspace.
