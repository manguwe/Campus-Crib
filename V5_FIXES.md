# Campus Crib V5 — UX + Feedback Fixes

## What changed

- Fixed the pre-launch research form's feedback submission RLS issue with `supabase_sql/32_v5_feedback_rls_and_ux.sql`.
- Reworked the pre-launch research interface into a multi-step, animated research experience.
- Added role cards, progress tracking, question cards, a rating interaction, better success state, and responsive modal styling.
- Added show/hide password controls to login, registration, and password reset forms.
- Added friendlier error handling for feedback submission.

## Supabase

Run this migration after V4 migrations:

```sql
supabase_sql/32_v5_feedback_rls_and_ux.sql
```

The migration recreates the public feedback INSERT policy for `anon` and `authenticated` users and grants the required table privileges.

## Local verification

```bash
npm install
npm run build
```
