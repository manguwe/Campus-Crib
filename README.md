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

## Student-facing features (search, favourites, detail page)

**New env var needed**: `VITE_GOOGLE_MAPS_API_KEY` — see `.env.local.example`.
Get one from the [Google Cloud Console](https://console.cloud.google.com/)
(enable the "Maps JavaScript API") and put the real value in `.env.local`,
never committed. Without it, the property detail page still works — it
just falls back to a plain "Open in Google Maps" link instead of an
embedded map.

- `/browse` — search page. Campuses are a hardcoded list in
  `src/lib/campuses.js` (no database table) with the three campuses you
  gave me; picking one re-centers the distance calculation
  (`src/lib/distance.js`, plain haversine, no external API needed for
  this part). All filtering (price, room type, building type, occupancy,
  toilet, amenities, distance) happens **client-side** after a single
  Supabase fetch — RLS is what actually restricts the fetch to `approved`
  rows, the filters just narrow what's already been safely returned. At
  this project's scale (single/few-campus launch) that's simpler than
  chaining multiple Supabase queries and is still fast.
- `/properties/:id` — full detail page: photo/video gallery, description,
  amenities (with icons), an embedded Google map (or fallback link),
  a contact button, and a reviews section.
- **Contact button**: only reveals the landlord's name/phone to
  logged-in users. `profiles` is only `SELECT`-able by `authenticated`
  users (Phase 2's RLS), not anonymous visitors, so an anonymous visitor
  sees "log in to contact landlord" instead — this mirrors a lot of
  real rental platforms (register to contact) rather than requiring a
  new public-profile RLS policy.
- **Reviews**: shown without a reviewer name for the same reason — an
  anonymous visitor can already read `reviews` rows (RLS allows it for
  approved properties) but not the linked `profiles` row, so showing
  reviews anonymously keeps the experience consistent for every visitor
  rather than showing names only when logged in.
- **Favourites**: `src/hooks/useFavourites.js` centralizes the
  heart-icon logic (optimistic add/remove, revert on failure) shared by
  the browse cards, the detail page, and `/favourites`. RLS already
  restricts a student to their own `favourites` rows.

## Reviews/ratings, notifications, and the admin dashboard

**Run in order** in the Supabase SQL Editor: `10_profile_privilege_fix_and_suspension.sql`,
then `11_notifications.sql`. Don't skip `10` even though it sounds unrelated —
it fixes a real privilege-escalation hole (see the file's header comment: any
logged-in user could previously set their own `role` to `'admin'`) discovered
while wiring up the "suspend a user" admin action.

- **Ratings**: `src/lib/ratings.js` aggregates `reviews` rows into a
  per-property average, computed client-side after a single fetch (same
  approach as the search filters) and shown via `RatingSummary` on cards
  and the detail page.
- **Notifications**: `11_notifications.sql` adds two `AFTER UPDATE`
  triggers — one on `landlord_profiles`, one on `properties` — that
  insert a `notifications` row whenever an admin's decision changes
  `verification_status` or `status`. They run `SECURITY DEFINER` (same
  pattern as `is_admin()`) so the insert succeeds even though there's
  still no client-facing `INSERT` policy on `notifications` — only
  trusted server-side code (this trigger) can write one, never the
  client directly. `NotificationBell.jsx` fetches on load and subscribes
  to Realtime `postgres_changes` INSERT events for live updates without a
  refresh; the migration also adds the table to the `supabase_realtime`
  publication, which is required for that subscription to receive
  anything.
- **Rejection reasons**: new `rejection_reason` text column on both
  `landlord_profiles` and `properties`, protected by the same triggers
  that already guard `verification_status`/`status` — only an admin can
  set it, and it's cleared automatically when a landlord resubmits.
- **Admin dashboard** (`/admin`, admin-only via `ProtectedRoute`) — four
  tabs: Overview (count-based stats via `{count: 'exact', head: true}`
  queries, no row data pulled), Landlord verifications (pending queue,
  approve/reject with a reason, view ID via signed URL), Properties (every
  listing regardless of status, inline approve/reject for pending ones,
  remove for any), Users (every profile, suspend/unsuspend toggle).
- **Suspension**: `profiles.is_suspended`, admin-only to change (same
  trigger-based column protection pattern). Currently enforced at two
  points — a suspended landlord can't `INSERT` a new property, a
  suspended student can't `INSERT` a new review — chosen as the two most
  meaningful lockout points without touching every table's policies.
  Existing listings/reviews aren't hidden by suspension; extend the
  pattern to other tables later if you want a broader lockout. Note this
  doesn't revoke login — that needs the Supabase Auth admin API (a
  service-role action, not something RLS can do), which is out of scope
  for this frontend-only architecture.

## Polish pass (responsive, loading/empty states, validation, RLS/storage audit)

**Shared UI (`src/components/ui/`)**
- `Spinner.jsx` / `PageLoading.jsx` — consistent inline / full-page loading indicators, used everywhere data is fetched.
- `EmptyState.jsx` — consistent "nothing here" block with icon + message + optional action, replacing ad hoc `text-gray-400` one-liners.
- `ErrorBanner.jsx` — consistent error display, paired with...
- `src/lib/errorMessages.js` — `formatSupabaseError(error, fallback)` maps common raw Postgres/RLS/GoTrue error strings (unique constraint violations, RLS policy rejections, invalid login, etc.) to plain-language messages instead of surfacing raw error objects. Every `setError(err.message)` call site in the app was swapped for `setError(formatSupabaseError(err, '…'))`.

**Responsive fixes**
- Navbar now has a mobile hamburger menu instead of cramming 6+ links into one row.
- Home page rebuilt as a real landing page (hero, working search bar that links to `/browse?campus=&priceMax=`, how-it-works section, landlord CTA).
- Browse reads `campus`/`priceMax` from the URL on load so the landing page search bar actually filters results.
- Landlord dashboard's listing rows, and the admin verification queue rows, stack vertically on mobile (`flex-col sm:flex-row`) instead of squeezing badges/buttons into one row.
- Admin Properties/Users tables wrapped in `overflow-x-auto` so they scroll horizontally on narrow screens instead of breaking layout.
- Admin dashboard's tab bar is horizontally scrollable (`overflow-x-auto`, `whitespace-nowrap`) so it doesn't wrap awkwardly on small screens.

**Form validation added**
- Registration: name length, phone format, email format, password length checked client-side before submit.
- Property editor: price > 0, latitude/longitude range checks, occupancy ≥ 1, toilet-sharing consistency.
- Reviews: comment length capped (1000 chars, enforced both client-side and via `maxLength`).
- Property media upload: client-side file size (25MB) and type (image/video only) checks before attempting upload.

**RLS audit (per table, what each role can/can't do — reviewed against 01–11)**
- `profiles`: anyone authenticated can read (needed for landlord contact info); a user can only update/insert their own row, and cannot set `role` to anything but student/landlord or touch `is_suspended` themselves (protected by trigger on UPDATE, and by policy on INSERT — see fix below); only admins can change role/suspension.
- `landlord_profiles`: landlord reads/inserts/updates only their own row; INSERT must be `status = 'pending'`; only admins can approve/reject or set `verified_at`/`verified_by`/`rejection_reason` (enforced by trigger — non-admin changes to these columns are silently reset).
- `properties`: anonymous + authenticated can read only `approved` listings; a landlord reads/manages only their own (any status); INSERT requires `status = 'pending'` and blocks suspended landlords; only admins can approve/reject or set `rejection_reason`.
- `property_media`: readable by anyone for approved properties; writable only by the owning landlord (checked via a join back to `properties.landlord_id`).
- `favourites`: a student can only read/insert/delete their own rows.
- `reviews`: anyone authenticated can read; a student can insert/update/delete only their own review, and INSERT blocks suspended students.
- `notifications`: a user can only read/mark-read their own; there is intentionally **no** client-facing INSERT policy — rows are only ever created by the `notify_*` SECURITY DEFINER triggers.
- **Fix applied (`12_polish_fixes.sql`):** the `profiles` INSERT policy previously only checked `id = auth.uid()`, without restricting `role`. In the live signup flow this was unreachable (the `handle_new_user` trigger creates the profile row first, bypassing RLS), but it was still a real gap in the policy itself — closed by requiring `role in ('student','landlord')` and `is_suspended = false` at insert time too, mirroring the existing UPDATE protection.

**Storage bucket audit**
- `landlord-documents` — **private**, correct: contains ID documents, never served via public URL, only ever via short-lived signed URLs generated server-side (well, client-side but gated by the private bucket + folder-scoped policy) for the owning landlord or an admin.
- `property-media` — **public**, correct: photos/videos are meant to be visible to anyone browsing listings, and public bucket URLs are the simplest correct mechanism for that.
- Both buckets scope writes to `storage.foldername(name)[1] = auth.uid()::text` (or the landlord's id for property-media), so a landlord can't write into another landlord's folder.
- Known minor gap (not fixed this pass, not a security issue): deleting a property or its media rows doesn't delete the underlying storage objects, so files can become orphaned in `property-media` over time. Worth a periodic storage cleanup script if this matters before launch.



- No backend server is set up (and shouldn't be needed for most features) —
  the frontend talks to Supabase directly using the anon key, with
  permissions enforced through Postgres Row Level Security (RLS) policies.
- Only add a thin custom server (Node/Express, or Supabase Edge Functions)
  later if something genuinely can't be expressed as an RLS policy or
  client-side query — e.g. distance-from-campus calculations or admin-only
  bulk actions.
- Database tables, RLS policies, and Storage buckets have **not** been
  created yet — that's the next build phase (authentication + schema).

## Realtime StrictMode fix + error boundary

- **`NotificationBell.jsx` realtime crash fix**: in dev, React 18 StrictMode mounts, cleans up, and re-mounts every component once as a way of surfacing effects that aren't cleanup-safe. `supabase.removeChannel()` unsubscribes over the websocket asynchronously, so the second mount's `supabase.channel('notifications:<id>')` could run before the first mount's channel had actually finished being removed from the client's internal registry - calling `.on()` on it then throws `cannot add 'postgres_changes' callbacks... after subscribe()`. Fixed by explicitly looking up and removing any channel already registered for that exact topic (`supabase.getChannels().find(...)`) before creating a new one, so each effect invocation always starts clean instead of racing the previous invocation's async teardown.
- **Error boundary**: `src/components/ErrorBoundary.jsx` (class component - React has no hook equivalent for catching render errors) shows a friendly "Something went wrong" card instead of a blank white page. Applied at two levels: once around the whole app in `main.jsx` (catches crashes in the Navbar, AuthProvider, or routing itself), and again around just `<Routes>` in `App.jsx` (catches a crash in a single page while keeping the Navbar usable so the person can navigate away without a full reload).

## Phase 5.5 — custom amenities, multiple contact numbers, click-to-pin map, occupancy presets

**Custom amenities** — `AmenitiesCheckboxes.jsx` now also renders any entry in the `amenities` array that isn't one of the preset checklist values as a removable chip, plus a text input + Add button to append new free-text ones. Still the same jsonb column, no schema change. `PropertyDetail.jsx`'s amenities section previously filtered to only known preset values (silently dropping anything custom) — fixed to show the full array, using the preset label where one matches and the raw text otherwise.

**Multiple labeled contact numbers** — built against the `property_contacts` table you migrated (assumed columns: `id, property_id, contact_type [call|sms|whatsapp], phone_number, label, sort_order`, with the RLS you described: public read for approved properties, landlord manages their own, admin reads all). New `PropertyContactsManager.jsx` on the listing editor (edit mode only, same pattern as the media manager — needs a real property id) lets a landlord add/remove numbers with a type and optional label. `ContactLandlordButton.jsx` on the property detail page now fetches `property_contacts` for the listing first; if there are any rows, it renders each with the correct link (`tel:` / `sms:` / `https://wa.me/...`); if there are zero, it falls back to the landlord's `profiles.phone` exactly as before. New `src/lib/phone.js` centralises the tel/sms/WhatsApp link + Zambian number normalization logic (`09XXXXXXXX` and `+2609XXXXXXXX` both resolve to the same `260...` wa.me number) so it's not duplicated across components.

*If your live `property_contacts` column names differ from the above, `PropertyContactsManager.jsx`'s `.select(...)`/`.insert(...)` calls and `ContactLandlordButton.jsx`'s `.select(...)` call are the only places that need adjusting.*

**Click-to-pin map** — new `LocationPicker.jsx` renders an interactive Google Map on the listing form; clicking or dragging the marker updates `latitude`/`longitude`. The Google Maps script-loading logic used to live only in `GoogleMapPin.jsx` (the read-only map on the property detail page) — it's now shared via `src/lib/googleMaps.js` so both components use the same loader/cache. "Use my current location" reuses the geolocation handler that already existed in `PropertyEditor.jsx` (passed down as a prop) rather than duplicating it. The old manual lat/lng number inputs are kept as a collapsed "Enter coordinates manually instead" fallback, in case the map fails to load.

**Occupancy presets** — `constants.js` adds `OCCUPANCY_OPTIONS` ("Room for 1" ... "Room for 5+"); the listing form's occupancy field is now that select instead of a raw number input. "5+" is stored as a plain `5` in the existing integer column. `propertyDisplay.js` adds `occupancyLabel()` (renders `5` back out as "Room for 5+") and the property card/detail summary line now reads "Room for 2" instead of "Fits 2".

## Phase 5.6 — brand palette, About/Contact pages, feedback

**Color palette** — `tailwind.config.js` adds `primary` (#0B3D62, deep blue), `accent` (#0F9D8C, teal), `background` (#F8FAFC, soft white) and `ink` (#1E293B, dark slate) as their own color keys, kept deliberately separate from Tailwind's default gray/green/amber/red scales so the approved/pending/rejected status badge system (`STATUS_BADGE_STYLES` in `constants.js`) is completely untouched. Applied to: `body` background/text (`index.css`), every primary action button app-wide (previously `bg-gray-900`/`hover:bg-gray-700`, now `bg-primary`/`hover:bg-primary-dark`), form focus rings, page headings (`<h1>`/`<h2>` only — left prices, stat numbers, and other bold-but-not-a-heading text alone), links (`text-accent underline`), and nav/footer hover states (`hover:text-primary`).

**About page** (`/about`) — platform intro adapted from the knowledge base's Executive Summary, plus a placeholder Team section (`src/pages/About.jsx` — edit the `TEAM` array with real names/roles/bios).

**Contact page** (`/contact`) — placeholder email/phone (edit directly in `src/pages/Contact.jsx`), links through to the feedback form for anything specific.

**Feedback** — new `src/pages/Feedback.jsx` at `/feedback`, no login required; pre-fills name/email from the profile and sets `submitted_by` when logged in, both stay optional either way, only `message` is required. Built against the `feedback` table you migrated (`id, submitted_by, name, email, message, created_at, is_read`, with your described RLS — anyone can submit, only admins can read/update). New "Feedback" tab on the admin dashboard (`AdminFeedback.jsx`) lists submissions newest-first with a mark read/unread toggle and an unread "New" badge.

**Footer** — new `src/components/Footer.jsx`, added to `App.jsx`'s layout (flex column, footer pinned to the bottom via `mt-auto`), linking to Browse/About/Contact/Feedback.

## Phase 5.6 (complete) — visual polish, testimonials, seed photo fix

**Visual polish**
- Input focus rings across every form switched from `focus:ring-primary` to `focus:ring-accent` (deep blue is for buttons/headings/nav; teal is the interactive-state accent, per the brief).
- `PropertyCard.jsx` reworked: price is now the largest/boldest element (`text-lg font-bold text-primary`), title and detail summary are visibly secondary below it; building-type/distance badges are pill-shaped with a tinted brand background (`bg-primary/10`/`bg-accent/10`) instead of plain gray/blue; cards now lift and gain a stronger shadow on hover (`hover:-translate-y-0.5 hover:shadow-lg`), and the thumbnail image gets a subtle zoom on hover.
- Forms (registration, login, listing editor, verification) already used bordered card sections and consistent label styling from the earlier polish pass — confirmed those still line up with this phase's brief, no structural changes needed there beyond the focus-ring color.
- Secondary/cancel buttons (e.g. the review form's Cancel button) use a bordered, gray-text style so they read as clearly secondary next to solid primary-blue submit buttons.

**Seed data placeholder photos** — the 9 seed listings' `property_media` rows used `picsum.photos` (random stock photos - could be anything, including a beach or a phone on a desk). Swapped for `placehold.co` with a neutral background and a "Photo coming soon" label, which actually reads as "no real photo yet" rather than misleading stock imagery. `03_seed.sql` updated for future fresh seeds; **`14_fix_seed_photo_placeholders.sql`** added as a one-off `UPDATE` to fix already-seeded rows in a live database (only touches rows whose URL matches the old picsum pattern, so real landlord-uploaded Storage URLs are never touched — safe to run regardless of whether you've already seeded).

**About page** — added optional GitHub + portfolio link icons per team member card (`Github`/`Globe` icons, open in a new tab, hidden individually if left blank). Edit the `TEAM` array in `src/pages/About.jsx`.

**Contact page** — rebuilt with four clickable actions: Call (`tel:`), SMS (`sms:`), Facebook (placeholder page URL), and WhatsApp as the clearly most prominent call-to-action (large solid-accent button up top, `https://wa.me/<number>`). Placeholder phone number and Facebook URL are declared as constants at the top of `src/pages/Contact.jsx` for easy editing.

**Testimonials** — `AdminFeedback.jsx` now has a second toggle per entry ("Feature as testimonial" / "Unfeature") alongside the existing read/unread toggle, writing to the `show_as_testimonial` column. Home page adds a "What people are saying" section that queries `feedback` where `show_as_testimonial = true`, newest first, limited to 6 - and is omitted entirely (not shown empty) when there are zero featured testimonials yet.

## Phase 5.6 (bug fixes + deeper polish) — lightbox gallery

Most of this round's requested bug fixes (toilet-sharing label, amenity label humanization, footer brand color, styled register buttons, back-to-listings button, room_type removal from the UI while keeping the column, styled `<select>`s, icon-pill amenities checklist, tinted section cards, page background depth) were already in place from the prior pass — verified each one against the file contents rather than re-doing them blind.

The one genuinely missing piece: **`src/components/Lightbox.jsx`**, a full-screen modal gallery — arrow-key/button navigation between all photos for a listing, scroll-wheel + two-finger pinch zoom on images, inline video playback with normal controls, a download button, and Escape/backdrop-click to close. Wired into:
- `PropertyDetail.jsx` — clicking any gallery thumbnail opens it (main target, per the brief)
- `PropertyMediaManager.jsx` — same on the landlord's own upload form, which was also rebuilt with proper card-treatment thumbnails, a styled trash-icon remove button, and an always-visible dashed-border "Add photos/videos" dropzone tile so the section never reads as empty even with 0-2 photos.

## Phase 5.6 (round 3) — real bugs fixed, motion pass, dashboard contrast

**Bugs fixed**
1. `PropertyEditor.jsx`'s Title, Description, Price, and Currency inputs were genuinely missing their `className` entirely (a copy/paste gap) — rendered as bare browser-default inputs. Fixed to match the rest of the form.
2. `AdminFeedback.jsx` messages now have `break-words` alongside `whitespace-pre-wrap`, so long unbroken strings wrap inside the card instead of overflowing.
3. Added `<meta name="color-scheme" content="light">` to `index.html`, plus explicit `color-scheme: light` and explicit `background-color`/`color` on `html, body` in `index.css` — guards against some Android browsers' forced-dark-mode auto-inversion making text invisible.
4. Email confirmation: this is a **Supabase Dashboard setting** (Authentication → Providers → Email → "Confirm email") that I can't check or flip myself — please verify it's ON. The frontend already handles the "please confirm your email" message correctly once it is. Wrote `15_defer_profile_creation_to_email_confirmation.sql` as the optional hardening mentioned in the brief (moves `handle_new_user()` from firing on signup to firing when `email_confirmed_at` transitions from null) — **do not run this until "Confirm email" is confirmed ON**, since with it off there's no null→timestamp transition for the trigger to ever fire on, and no profile row would ever get created.
5. Browse now has a "Sort by" dropdown (Distance / Price low-high / Price high-low / Rating), persisted as `?sort=` in the URL.
6. Background tint bumped from `#F8FAFC` to a more visibly blue-grey `#EEF2F8`, plus more breathing room (`App.jsx` main padding, dashboard `space-y`) so the tint is actually visible around card content instead of reading as stark white.

**Motion pass**
- Every solid primary/accent button app-wide gets a smooth `hover:scale-[1.02] active:scale-[0.98]` press feel; every bordered secondary button gets `transition-colors`.
- New `.animate-fade-in-up` CSS keyframe (`index.css`), applied with a staggered delay to the Browse and Favourites result grids and to Home's sections.
- Lightbox videos now autoplay muted + looped + `playsinline` when opened (controls stay visible; never autoplays sound).
- Navbar: mobile menu now slides/fades open via animated max-height/opacity instead of popping in instantly, the hamburger icon animates into an X, and nav links get an animated underline with an active-route indicator.
- `ProtectedRoute.jsx`'s full-page loading state and four form submit buttons (review, listing save, verification upload, feedback send) that showed static "Saving…"/"Uploading…"/"Sending…" text now show an animated spinner icon alongside the label.

## Phase 5.7 — activity tracking

Built against the `activity_logs` table you migrated (`id, user_id, role, event_type, path, details jsonb, created_at`, anyone can insert including guests, only admins can read).

**Logging infrastructure**
- `src/lib/activityLog.js` — `logActivity(eventType, { path, details })`. Deliberately fire-and-forget: never awaited by any caller, and a failed insert is only `console.warn`'d, never thrown, so a logging hiccup can never break the actual action it's attached to (submitting a review, saving a listing, etc).
- `src/lib/activityIdentity.js` — a tiny module-level store for the current `user_id`/`role`, kept in sync by `AuthContext` on every profile load/clear. `activityLog.js` reads from this synchronously instead of re-querying the session on every single log call. Both are `null` for a guest, which matches the RLS policy.

**What's logged, and where**
- `page_view` — `App.jsx`, a `useEffect` on React Router's `location.pathname`.
- `login` / `logout` / `signup` (with `role`) — `AuthContext.jsx`. `signup` logs immediately since the role is already known from the caller; `login` looks up the role in the background (not awaited, so it adds zero latency to the actual sign-in flow); `logout` captures the role just before it's cleared.
- `listing_created` / `listing_updated` (with `property_id`) — `PropertyEditor.jsx`, right after a successful insert/update.
- `favourite_added` / `favourite_removed` (with `property_id`) — `useFavourites.js`, after the DB write succeeds (not on the optimistic UI flip, so a rolled-back failure never gets logged as a success).
- `review_submitted` (with `property_id`, `rating`) — `ReviewsSection.jsx`, only on the first submission (editing an existing review doesn't re-log it, matching the single event name asked for).
- `search_performed` (with every `SearchFilters` field: campus, price range, building type, occupancy, toilet, distance, amenities) — `Browse.jsx`, debounced 800ms after the last filter change so rapid checkbox/slider adjustments don't spam a row per click, and skipped on the very first render (that's just the default state loading, not something the person did).
- `error` (with message + stack + component stack) — `ErrorBoundary.jsx`'s `componentDidCatch`, alongside the existing console.error and friendly fallback UI (both already existed from an earlier phase; this just adds the log call).

**Admin — per-user activity timeline**
- New "View activity" action per row on the Users tab opens `UserActivityModal.jsx` — a reverse-chronological list (most recent 200 events) of that user's `activity_logs`, each showing timestamp, an event-type badge, the path, and a short human-readable summary of the `details` payload (`src/lib/activitySummary.js` — e.g. `review_submitted` → "property a1b2c3d4 · 4★", `search_performed` → "campus: unza-gerc, price: 1500–3000, 2 amenities"). `error` rows get a small warning icon so a crash stands out immediately when scanning the timeline.

## Phase 5.8 — role-based routing fixes

**New:** `src/lib/roleRoutes.js` — `dashboardPathForRole(role)`, a single shared mapping (`admin`→`/admin`, `landlord`→`/landlord`, `student`→`/student`, anything else→`null`) used by `Login.jsx`, `Home.jsx`, `Browse.jsx`, and `Navbar.jsx` so all four stay consistent. Deliberately returns `null` rather than a fallback path like `/` for an unrecognized role - a caller like `Home.jsx` needs to tell "no known destination" apart from "the destination is home" to avoid a redirect-to-self loop.

1. **Login redirect bug** - `Login.jsx` had a comment about falling back to a role-appropriate dashboard but the code just did `navigate('/')`. `AuthContext.signIn` now awaits a role lookup (previously fire-and-forget, used only for the activity log) and returns it directly, so `Login.jsx` can navigate to `dashboardPathForRole(role)` without waiting on `profile` state to catch up asynchronously - the original bug's root cause was the `profile` value not necessarily being fresh yet in the same render right after `signIn()` resolves. `from` (the page `ProtectedRoute` bounced them from) still takes priority when present.

2. **Landing page for guests only** - `Home.jsx` now redirects any authenticated visitor straight to their role dashboard (gated on `loading` so it doesn't fire before the initial auth check resolves). Placed *after* all of Home's own hooks, not interleaved with them, per the Rules of Hooks. The now-unreachable "logged in" branch of the hero's button row (a "Go to your dashboard" link) was removed as dead code rather than left dangling.

3. **Browse restricted to students/guests** - `Browse.jsx` redirects a logged-in landlord to `/landlord` (guests and students pass through unaffected), same placement-after-all-hooks pattern as Home. `Navbar.jsx`'s "Browse" link is hidden (both desktop and mobile menu) whenever the logged-in user's role is `landlord`; visible for guests, students, and admins. Note: I left the Footer's own "Browse" link as-is since only the Navbar was specifically called out - clicking it would still correctly redirect a landlord via the `Browse.jsx` guard either way, so there's no broken behavior, just a minor inconsistency in affordance if that matters to you later.

**Walkthrough confirmed:**
- Logged-out visitor → sees the normal landing page, can Browse freely. ✓.
- Student logs in → lands on `/student`, not `/`. ✓ (role returned directly from `signIn`).
- Visiting `/` while logged in (any role) → immediate redirect to that role's dashboard. ✓.
- Landlord → never sees "Browse" in the navbar, and typing `/browse` directly redirects them to `/landlord`. ✓.
