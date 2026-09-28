# Campus Crib V17 — Phone requirements + startup reliability

## 1. Supabase migration
Run:

`supabase_sql/41_phone_requirements_and_existing_user_contacts.sql`

This migration:
- requires a valid mobile number for all future Campus Crib signups at the database trigger level;
- stores student/admin phones on `profiles`;
- keeps landlord registration phones in `private_landlord_contacts`;
- fixes the Admin Users directory so landlord registration phones are visible to admins;
- adds `get_my_phone()` for the current user's own phone;
- adds `update_my_phone()` so existing users without a phone can complete their account.

## 2. Existing users without a phone
V17 shows students and landlords who have an existing account with no phone a required "Add your mobile number" screen. They must add the number before continuing.

## 3. New registrations
The mobile number field is required in both Student and Landlord registration. Client validation checks for 7–15 digits after removing formatting characters.

The database trigger also rejects future signups that omit an acceptable mobile number, so the requirement cannot be bypassed by a different client.

## 4. Startup/loading reliability
The previous AuthContext called asynchronous Supabase queries directly from `onAuthStateChange`. Supabase documents a deadlock/hang risk for async Supabase calls inside that callback. V17 keeps the callback lightweight and schedules profile/referral work outside it.

V17 also adds bounded startup timeouts:
- Auth startup: 12 seconds
- Profile/role/phone requests: 7 seconds
- Platform mode: 6 seconds

If platform mode cannot be reached, the app safely falls back to Pre-Launch instead of holding the whole site on an infinite spinner.

## 5. Testing the reported Samsung S22 Ultra issue
After deployment, test on the same S22 Ultra in:
1. Samsung Internet
2. Chrome
3. Wi-Fi
4. Mobile data
5. Incognito/private mode

Also test these direct files:
- `/favicon.png`
- `/manifest.json`
- `/sw.js`

If the direct files load but the app stays on a spinner, inspect the browser console/network requests for the Supabase domain. If even the static files fail, investigate DNS/network/Vercel delivery rather than React/Supabase application logic.

## 6. Supabase/Vercel checks
Check:
- Supabase project health and API response times;
- Vercel deployment status and runtime logs;
- whether the affected phone is using a VPN, Private DNS, ad/content blocker, or restricted network;
- whether the issue disappears on mobile data vs Wi-Fi.

Do not treat clearing browser data as the permanent fix; it is only a diagnostic step for stale browser data.

## 7. Build
From the project root:

`npm install`

`npm run build`

The V17 archive was created from the V16 source with the changes above. Dependency installation/build could not be completed in this environment because npm package installation timed out, so verify the build in your local/deployment environment before publishing.
