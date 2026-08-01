# Student Boarding House Finder

A web platform connecting students with verified landlord-listed boarding
houses near their university.

**Stack:** React (Vite) + Tailwind CSS on the frontend, [Supabase](https://supabase.com)
(hosted Postgres + Auth + Storage) as the backend, accessed directly from the
frontend via `@supabase/supabase-js`.

This is currently just a **scaffold**: a clean skeleton that confirms the
frontend can talk to Supabase. No auth, listings, or other features are
built yet.

---

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or later (v20 LTS recommended)
- A free [Supabase](https://supabase.com) account and project

## 1. Install dependencies

```bash
npm install
```

## 2. Set up your Supabase credentials

1. Create a project at [supabase.com](https://supabase.com) if you haven't already.
2. In your Supabase dashboard, go to **Project Settings > API**.
3. Copy the **Project URL** and the **anon public** key.
4. Copy the example env file and fill in your values:

   ```bash
   cp .env.local.example .env.local
   ```

5. Edit `.env.local`:

   ```env
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-public-key
   ```

`.env.local` is already listed in `.gitignore` — never commit real
credentials to version control.

## 3. Run the dev server

```bash
npm run dev
```

Open the printed local URL (usually `http://localhost:5173`). You should see
a **Supabase Connection Test** card:

- 🟡 **Checking connection…** while it verifies the client can reach Supabase
- 🟢 **Connected** once the frontend successfully reaches your Supabase
  project's Auth API (this works even before you've created any database
  tables)
- 🔴 **Not connected** if credentials are missing/incorrect, or the project
  can't be reached — the detail message will explain why

## Project structure

```
student-boarding-house-finder/
├── src/
│   ├── lib/
│   │   └── supabaseClient.js   # Supabase client, initialized from env vars
│   ├── pages/
│   │   └── ConnectionTest.jsx  # Verifies the Supabase connection on load
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css               # Tailwind directives
├── .env.local.example          # Template — copy to .env.local, fill in, never commit
├── .env.local                  # Your real credentials (git-ignored, not committed)
├── tailwind.config.js
├── postcss.config.js
├── vite.config.js
└── package.json
```

## Authentication

Auth is wired up with `supabase.auth.signUp()` / `signInWithPassword()`,
role-based route protection, and session persistence across reloads.

**Before running the app**, make sure your Supabase project has the schema
from the project's SQL files applied, in order: `01_schema.sql`,
`02_policies.sql`, `03_seed.sql` (optional), `04_auth_trigger_update.sql`.
The `on_auth_user_created` trigger these create is what turns a signup into
a `profiles` row (and, for landlords, a `landlord_profiles` row) — the
frontend never inserts those rows itself.

- `/register/student` and `/register/landlord` — separate forms that both
  call `signUp()`, passing `role` in the signup metadata.
- `/login` — `signInWithPassword()`.
- `/student`, `/landlord`, `/admin` — protected by `<ProtectedRoute>`, which
  reads the logged-in user's `role` from their `profiles` row and redirects
  anyone without the right role to `/unauthorized`.
- Session state lives in `src/context/AuthContext.jsx`, which restores any
  existing session on load (`supabase.auth.getSession()`) and subscribes to
  `onAuthStateChange` for sign-in/sign-out/token-refresh events — this is
  what keeps you logged in across a page reload.

**Creating the first admin account** — there's no admin registration form
on purpose. See `05_create_first_admin.sql` for the full walkthrough:
create the user via the Supabase Dashboard, then run one `UPDATE` to set
their `profiles.role` to `'admin'`.

## Landlord features (verification, listings, media)

**Before running this phase**, apply the new SQL files in order in the
Supabase SQL Editor: `06_storage_buckets.sql`, then `07_security_fixes.sql`.
The latter closes two real gaps found while building this phase — see the
comments at the top of that file — so don't skip it even if you already ran
Phase 1/2's SQL.

- `/landlord/verification` — uploads an ID document to the private
  `landlord-documents` bucket (path: `{user_id}/{filename}`) and writes the
  storage path (not a public URL — the bucket is private) into
  `landlord_profiles.id_document_url`, resetting `verification_status` to
  `pending`. Viewing the doc uses a short-lived signed URL, generated
  on demand.
- `/landlord` — dashboard listing the landlord's own properties (any
  status) plus a verification-status banner. Querying with
  `.eq('landlord_id', user.id)` is for efficiency; the actual security
  boundary is the `properties` RLS policy from Phase 1, which already
  restricts non-admins to `approved` rows or their own.
- `/landlord/properties/new` and `/landlord/properties/:id` — one form
  handles both create and edit. Latitude/longitude are plain number
  fields for now (plus a "use my current location" button) — swap in a
  click-to-pin Google Map later without touching the database, since it's
  writing to the same `latitude`/`longitude` columns either way.
- Photos/videos upload to the public `property-media` bucket (path:
  `{landlord_id}/{property_id}/{filename}`) and get inserted into
  `property_media` with their public URL.

**Testing that pending listings stay hidden from students** — see
`08_test_rls_as_user.sql` for two approaches: testing with two real
browser sessions (most realistic), or impersonating specific users
directly in the SQL Editor (the SQL Editor otherwise runs as a superuser
that bypasses RLS, so a plain `select * from properties` there is not a
valid test).

## New property fields (building type, occupancy, toilet, walk time)

Four new nullable columns on `properties` — `building_type`, `occupancy`,
`toilet_shared_by`, `walk_minutes_to_campus` — plus an expanded amenities
checklist (same `amenities` jsonb column, no schema change needed for
those). See `supabase_sql/09_property_extra_fields.sql` if you need to
(re)apply the migration; it's idempotent (`IF NOT EXISTS`).

- The create/edit form (`PropertyEditor.jsx`) now has a building type
  dropdown, an occupancy number input, a Private/Shared-by-N toilet
  control, and a walk-time-to-campus number input.
- `toilet_shared_by` follows the "null or 0 = private" convention exactly
  as specified — the form's "Private" radio button clears it to `null`.
- **Public browse/detail pages are new in this phase** — there wasn't one
  yet to update, so `/browse` (grid of approved listings) and
  `/properties/:id` (full detail page) were added, both querying
  `properties` directly and relying on the same RLS policy from Phase 1 to
  only ever return `approved` rows to non-owners. `src/lib/propertyDisplay.js`
  builds the one-line summary (e.g. "Self-contained · Fits 2 · Private
  bathroom · 5 min walk to campus") shared by the browse cards, the detail
  page, and the landlord dashboard's own listing rows.
- Note: the expanded amenity list dropped a few old values (`private_bathroom`,
  `kitchenette`, `shared_kitchen`, `female_only`, `shuttle_nearby`,
  `minibus_route`) that existed in earlier seed data — those values still
  sit harmlessly in any old listing's `amenities` array, they just won't
  render a checkbox in the editor anymore since they're not in the new list.

## Notes for future build phases

- No backend server is set up (and shouldn't be needed for most features) —
  the frontend talks to Supabase directly using the anon key, with
  permissions enforced through Postgres Row Level Security (RLS) policies.
- Only add a thin custom server (Node/Express, or Supabase Edge Functions)
  later if something genuinely can't be expressed as an RLS policy or
  client-side query — e.g. distance-from-campus calculations or admin-only
  bulk actions.
- Database tables, RLS policies, and Storage buckets have **not** been
  created yet — that's the next build phase (authentication + schema).
