# Campus Crib V9 Setup

V9 improves call identity and WebRTC reliability. Run migrations through V8 first, then run `supabase_sql/35_v9_call_identity_and_reliable_audio.sql`.

The caller sees the selected person's name and, when permitted by the existing listing/contact model, a fallback phone number. The callee does not receive the caller's phone/email from this feature.

The call signaling client now re-reads stored signals after subscribing and queues ICE candidates until a remote description exists, fixing the common silent-call/race condition.

For production, a TURN server should still be added to the WebRTC ICE configuration for difficult NAT/mobile networks.
