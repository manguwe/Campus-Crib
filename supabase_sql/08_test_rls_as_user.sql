-- =========================================================================
-- Student Boarding House Finder — Manually testing RLS as a non-admin
--
-- IMPORTANT: the SQL Editor runs your queries as the Postgres superuser
-- (or "postgres" role), which BYPASSES RLS completely. Running
-- `select * from properties` in the SQL Editor will always show you
-- every row, regardless of status - that is NOT a test of whether RLS
-- works, it's just superuser access.
--
-- Two ways to actually test it:
--
-- OPTION A — the real way: two browser windows
--   1. Open the app in a normal window, register/log in as a student.
--   2. Open a private/incognito window, log in as a different landlord
--      whose listing is still 'pending'.
--   3. As the student, confirm you do NOT see the landlord's pending
--      listing anywhere (dashboard/browse). As the landlord, confirm you
--      DO see your own pending listing on /landlord.
--   This is the most realistic test because it goes through the anon key
--   + real session tokens exactly like production traffic would.
--
-- OPTION B — impersonate a user from the SQL Editor
--   Postgres lets you fake the JWT claims a request would normally carry,
--   then switch to the `authenticated` role so RLS actually applies.
--   Replace the UUIDs below with real ones from your `profiles` table.
-- =========================================================================

-- Pick a real student UUID and a real "pending" property's landlord UUID
-- first:
select id, name, role from public.profiles order by role;
select id, title, status, landlord_id from public.properties order by status;

-- Then, as that student, this block should NOT return any 'pending' or
-- 'rejected' rows belonging to someone else:
begin;
  select set_config('request.jwt.claims', json_build_object(
    'sub', 'PASTE_STUDENT_UUID_HERE',
    'role', 'authenticated'
  )::text, true);
  set local role authenticated;

  select id, title, status from public.properties; -- expect: approved only
rollback; -- always rollback so this never actually commits anything

-- Now as the landlord who owns a pending listing - this SHOULD include
-- their own pending/rejected rows, on top of any approved ones:
begin;
  select set_config('request.jwt.claims', json_build_object(
    'sub', 'PASTE_LANDLORD_UUID_HERE',
    'role', 'authenticated'
  )::text, true);
  set local role authenticated;

  select id, title, status, landlord_id from public.properties; -- expect: approved (all) + own pending/rejected
rollback;

-- Bonus - confirm GAP 1 from 07_security_fixes.sql is actually closed:
-- as that same landlord, try to sneak an approved listing straight past
-- moderation. This INSERT should be REJECTED by the WITH CHECK clause.
begin;
  select set_config('request.jwt.claims', json_build_object(
    'sub', 'PASTE_LANDLORD_UUID_HERE',
    'role', 'authenticated'
  )::text, true);
  set local role authenticated;

  insert into public.properties (landlord_id, title, price, status)
  values ('PASTE_LANDLORD_UUID_HERE', 'Sneaky self-approved listing', 999, 'approved');
  -- expect: ERROR - new row violates row-level security policy
rollback;
