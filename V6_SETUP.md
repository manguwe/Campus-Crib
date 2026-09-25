# Campus Crib V6 — Agent Fee + Protected Contact Access

V6 adds a controlled, admin-reviewed access workflow for landlord contact details and exact property coordinates.

## 1. Install

```bash
npm install
npm run build
```

## 2. Supabase migration

Run this migration **after migrations 01–32 have already been applied**:

```text
supabase_sql/33_v6_agent_fee_private_access.sql
```

It adds:

- Per-listing editable agent fee and currency.
- General/public coordinates (rounded) for browse/map previews.
- Private exact coordinates.
- Student payment-access requests.
- Private payment-proof storage bucket.
- Admin approval/rejection workflow.
- Protected landlord phone storage.
- RPCs for secure exact-location/contact access.
- Secure feedback submission RPC, fixing the public research-form RLS failure.

## 3. Intended workflow

1. Landlord creates a listing.
2. Listing enters the existing admin approval queue.
3. Admin sets/edits the listing's **Agent fee** in Admin → Properties.
4. Students can see the listing and general area.
5. The listing shows the agent fee but does **not** expose the exact coordinates or landlord phone.
6. A student uploads proof of payment.
7. Admin opens the proof in Admin → Access requests.
8. Admin approves or rejects it.
9. Approval unlocks the exact coordinates and landlord contact details for that student account.

## 4. Security model

The browser is never trusted to choose the fee. The request RPC reads the current fee from the database.

Exact coordinates are kept in `property_private_locations` and returned only through a security-definer RPC after access approval.

Landlord registration phone numbers are moved to `private_landlord_contacts`; the `profiles.phone` column is no longer readable through normal API roles.

## 5. Research form error

V5 submitted the research response directly to `feedback`, so a Supabase project where the feedback RLS migration had not applied could return:

`new row violates row-level security policy for table "feedback"`

V6 submits through `submit_feedback_public()`, a controlled security-definer RPC, while keeping feedback reads restricted to admins/testimonials.

## 6. Password visibility

Login and registration use the shared password field with an eye button for show/hide. No plaintext password is stored by Campus Crib; Supabase Auth handles the password.

## 7. Important

Do not expose exact coordinates or landlord contact numbers by adding them back to public `properties`/`profiles` selects. Use the protected RPCs included in V6.
