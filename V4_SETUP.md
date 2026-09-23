# Campus Crib V4 — Launch Readiness & Referral Analytics

V4 builds on V3. It does not replace the existing marketplace, authentication, listings, feedback, PWA, or referral system.

## What changed

- Launch-readiness dashboard in Admin Dashboard.
- Referral funnel by source: visits → users → interest → signups → profiles → feedback → listings.
- Pre-launch interest signals from the main feedback/invite calls-to-action.
- Referral-attributed listing creation tracking.
- Research coverage metrics by student, landlord, caretaker, and other.
- Current platform mode, active referral sources, invitation count, and feedback-attribution metrics.
- Safer browser detection in referral invitations.

## Supabase migration

Run this migration after the V3 migrations:

1. `28_referral_system.sql`
2. `29_referral_invitations.sql`
3. `30_pre_launch_platform_mode.sql`
4. `31_v4_launch_readiness_analytics.sql`

## Local verification

From the project directory:

```bash
npm install
npm run build
```

Vite dependencies are intentionally not bundled in the ZIP.
