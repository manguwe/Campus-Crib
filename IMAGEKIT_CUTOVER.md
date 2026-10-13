# Campus Crib ImageKit cutover (review branch only)

This patch routes **new** property media, landlord verification documents, and student payment proofs through the `imagekit-media` Supabase Edge Function. It does not migrate existing objects or change any Supabase project configuration.

## Required ImageKit Edge Function secrets

Set these in the **new/test Supabase project only**:

- `IMAGEKIT_PRIVATE_KEY` — server-side private API key; never add to Vite env or browser code.
- `IMAGEKIT_URL_ENDPOINT` — ImageKit URL endpoint, e.g. `https://ik.imagekit.io/<account_id>`.

The function uses Supabase's injected `SUPABASE_URL` and `SUPABASE_ANON_KEY`. Keep JWT verification enabled; do not deploy with `--no-verify-jwt`.

## Deployment order (do not run against production yet)

1. Confirm the CLI is linked to the intended **new/test** Supabase project.
2. Apply `supabase_sql/42_imagekit_media_refs.sql` there. It only adds nullable `property_media.storage_file_id`; it does not delete or rewrite existing rows or files.
3. Confirm the two ImageKit secrets are present by listing secret names only; never print values.
4. Deploy `imagekit-media` with JWT verification enabled.
5. Build and test the app against test credentials, including role denial, landlord-owned property upload, student proof upload, admin proof viewing, and legacy Supabase URLs.
6. Only after successful tests, decide a separate data migration and cutover plan. Do not delete old Supabase objects as part of this patch.

## Behavior

- Property media is public on ImageKit and records its ImageKit `fileId` in the additive `storage_file_id` column.
- Landlord verification documents and payment proofs are uploaded as ImageKit private files. The existing text columns store `ikfile:<fileId>` references; the existing approval/request RPC workflows remain in place.
- Private view requests are authenticated and checked against the caller's role and matching database record before a 5-minute ImageKit signed URL is returned.
- Existing legacy Supabase references still use the old signed-URL path. This is compatibility only, not a new-upload fallback.
- The ImageKit deletion path verifies landlord ownership before deleting an asset and its row. Legacy Supabase deletion remains limited to recognizable legacy public URLs.

## Important limits before production

- Existing Supabase-hosted assets are not migrated by this patch. Their delivery can continue to contribute to old-project egress until their references are migrated or traffic is otherwise stopped.
- A failed payment-request RPC can leave an unreferenced private ImageKit upload; cleanup support should be added/tested before production cutover.
- The local build could not be executed in this environment because dependencies were unavailable (`vite: not found`). Run `npm install` then `npm run build` locally before deployment.
- Never run `supabase db reset`, point migration scripts at the old project, or delete old storage objects during this test phase.
