# Campus Crib V10 Setup

V10 is the consolidated communication fix on top of V9.

## What changed

- Calls identify the actual person by their profile name.
- Incoming calls display the actual caller name even when another conversation is selected.
- Support conversations display `Campus Crib Support · <admin name>` instead of every support thread looking identical.
- Existing duplicate support conversations for the same student/admin pair are merged into the oldest conversation; messages and call records are moved before duplicates are removed.
- Future support-chat creation is protected by a unique student/admin support-pair key.
- A protected `get_voice_call_identity()` RPC returns caller/callee names for participants only.
- Existing V9 fallback contact behavior is preserved: the caller can see the called person's permitted fallback phone/email; the called person does not receive the caller's phone through this feature.
- V9 WebRTC signaling changes are preserved.

## Supabase

Run this migration after migrations 33, 34, and 35 have already been applied:

`supabase_sql/36_v10_named_calls_support_dedupe.sql`

If 35 has not been applied successfully, apply the corrected V9 migration first.

## Frontend

```bash
npm install
npm run build
```

## Test checklist

1. Log in as a student.
2. Open Messages.
3. Start Campus Crib Support.
4. Confirm the support conversation displays the admin's actual profile name.
5. If duplicate support threads existed before V10, confirm only one remains for that student/admin pair.
6. Open a landlord conversation and confirm the landlord's profile name appears.
7. Tap `Call <name>` and confirm the active call shows the same person.
8. On the receiving device, confirm the incoming-call dialog shows the caller's actual name.
9. Confirm the caller can see the called person's fallback phone when available.
10. Confirm the recipient does not receive the caller's phone through the call identity feature.
11. Answer the call and test two-way audio.
