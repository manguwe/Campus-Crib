-- =========================================================================
-- Student Boarding House Finder — Create the first admin account
-- Run this ONCE, manually, after creating the admin's auth user.
-- =========================================================================
--
-- Admins don't self-register through the app (there's no "Register as
-- Admin" form, on purpose — anyone could hit it otherwise). Instead:
--
-- STEP 1 — Create the auth user
--   Supabase Dashboard > Authentication > Users > Add user > Create new user.
--   Give it a real email you control and a strong password. You can leave
--   User Metadata blank — it'll default to role "student" via the
--   on_auth_user_created trigger, which is exactly what STEP 2 below fixes.
--
-- STEP 2 — Copy that user's UUID, then run this (replace the placeholder):
update public.profiles
set role = 'admin'
where id = 'ADMIN_AUTH_USER_UUID';

-- STEP 3 — Verify it worked:
select id, name, role from public.profiles where role = 'admin';
--
-- That's it — no landlord_profiles row is needed for an admin, and this
-- account can now log in through the normal /login page. Once your
-- ProtectedRoute checks profile.role === 'admin', they'll land on
-- /admin instead of /student or /landlord.
-- =========================================================================
