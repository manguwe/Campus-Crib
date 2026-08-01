-- =========================================================================
-- Student Boarding House Finder — Seed Data
-- Run this AFTER 01_schema.sql and 02_policies.sql.
--
-- WHY YOU CAN'T JUST INSERT USERS WITH SQL
-- -----------------------------------------
-- public.profiles.id is a foreign key into auth.users, and auth.users is
-- managed by Supabase Auth (it stores hashed passwords, session data,
-- etc. in a specific format). You can't just INSERT a row into auth.users
-- from the SQL Editor and expect a working account. So: create the auth
-- users first (dashboard or Admin API), THEN use their real UUIDs below.
--
-- STEP 1 — Create 7 fake auth users (2 landlords, 4 students, 1 admin)
-- -----------------------------------------------------------------------
-- Easiest way — Supabase Dashboard:
--   1. Go to Authentication > Users in your Supabase project.
--   2. Click "Add user" > "Create new user" for each of the 7 people
--      below. Use any email/password you like (e.g. mwansa.landlord@test.com
--      / TempPass123!) — these are just fake seed accounts.
--   3. In the "User Metadata" (or "Raw User Meta Data") field, you can
--      optionally paste JSON like this — the on_auth_user_created trigger
--      from 01_schema.sql will read it and pre-fill their profile:
--        {"name": "Mwansa Banda", "role": "landlord", "phone": "0977123456"}
--      If you skip this, the trigger still creates a profiles row with
--      default name "New User" / role "student" — the UPDATEs in STEP 2
--      below will fix that regardless, so metadata is a nice-to-have, not
--      required.
--   4. After creating each user, click into it and copy its UUID.
--
-- Alternative — Admin API (e.g. from a one-off Node script using your
-- SERVICE ROLE key, never the anon key):
--   const { data } = await supabaseAdmin.auth.admin.createUser({
--     email: 'mwansa.landlord@test.com',
--     password: 'TempPass123!',
--     email_confirm: true,
--     user_metadata: { name: 'Mwansa Banda', role: 'landlord' },
--   })
--   console.log(data.user.id)  // <- the UUID you need below
--
-- STEP 2 — Replace every placeholder UUID below with a real one
-- -----------------------------------------------------------------------
-- Find/replace these placeholders throughout this file with the UUIDs you
-- copied in Step 1:
--   LANDLORD_1_UUID   -> Mwansa Banda (landlord)
--   LANDLORD_2_UUID   -> Chanda Mumba (landlord)
--   STUDENT_1_UUID    -> Natasha Phiri (student)
--   STUDENT_2_UUID    -> Bwalya Mwape (student)
--   STUDENT_3_UUID    -> Kelvin Zulu (student)
--   STUDENT_4_UUID    -> Chileshe Tembo (student)
--   ADMIN_1_UUID      -> Admin account
--
-- Tip: with the placeholders written exactly like that (no quotes needed
-- around them in your find/replace, since they sit inside the existing
-- quotes below), a simple text find/replace in your editor is enough.
--
-- STEP 3 — Run this whole file in the SQL Editor.
-- =========================================================================

-- ---------------------------------------------------------------------
-- Profiles
-- Uses ON CONFLICT so this works whether or not on_auth_user_created
-- already inserted a bare-bones row for each user.
-- ---------------------------------------------------------------------
insert into public.profiles (id, name, role, phone) values
  ('ADMIN_1_UUID',    'Admin User',       'admin',    '0960000000'),
  ('LANDLORD_1_UUID', 'Mwansa Banda',     'landlord', '0977123456'),
  ('LANDLORD_2_UUID', 'Chanda Mumba',     'landlord', '0966234567'),
  ('STUDENT_1_UUID',  'Natasha Phiri',    'student',  '0955345678'),
  ('STUDENT_2_UUID',  'Bwalya Mwape',     'student',  '0977456789'),
  ('STUDENT_3_UUID',  'Kelvin Zulu',      'student',  '0966567890'),
  ('STUDENT_4_UUID',  'Chileshe Tembo',   'student',  '0955678901')
on conflict (id) do update set
  name  = excluded.name,
  role  = excluded.role,
  phone = excluded.phone;

-- ---------------------------------------------------------------------
-- Landlord verification records — both pre-approved so their listings
-- are immediately eligible to go live.
-- ---------------------------------------------------------------------
insert into public.landlord_profiles (id, verification_status, id_document_url, verified_at, verified_by) values
  ('LANDLORD_1_UUID', 'approved', 'https://example-storage.test/ids/mwansa-nrc.jpg', now(), 'ADMIN_1_UUID'),
  ('LANDLORD_2_UUID', 'approved', 'https://example-storage.test/ids/chanda-nrc.jpg', now(), 'ADMIN_1_UUID')
on conflict (id) do update set
  verification_status = excluded.verification_status,
  id_document_url      = excluded.id_document_url,
  verified_at           = excluded.verified_at,
  verified_by            = excluded.verified_by;

-- ---------------------------------------------------------------------
-- Properties — 9 listings near a university campus (coordinates are
-- illustrative points around a Lusaka campus area; adjust to your real
-- target campus once you fill in "Target university / campus
-- coordinates" in the project Decisions Log).
-- ---------------------------------------------------------------------
insert into public.properties
  (id, landlord_id, title, description, price, currency, address_text, latitude, longitude, room_type, amenities, status)
values
  (gen_random_uuid(), 'LANDLORD_1_UUID', 'Sunny Single Room near Great East Road Campus',
    'Quiet single room 5 minutes'' walk from the main gate. Secure yard, own key.',
    1800.00, 'ZMW', 'Off Great East Road, Lusaka', -15.3922, 28.3231,
    'single', '["wifi", "water_included", "electricity_included", "security_guard"]', 'approved'),

  (gen_random_uuid(), 'LANDLORD_1_UUID', 'Shared Room, 2 Students, Near Campus Shuttle Stop',
    'Twin-share room, shuttle stop right outside. Ideal for first-years.',
    1100.00, 'ZMW', 'Kalundu, Lusaka', -15.3960, 28.3255,
    'shared', '["wifi", "shuttle_nearby", "shared_kitchen"]', 'approved'),

  (gen_random_uuid(), 'LANDLORD_1_UUID', 'Self-Contained Bedsitter with Private Bathroom',
    'Fully self-contained unit, own bathroom and small kitchenette.',
    2600.00, 'ZMW', 'Chelston, Lusaka', -15.3890, 28.3300,
    'self_contained', '["wifi", "private_bathroom", "kitchenette", "borehole_water"]', 'approved'),

  (gen_random_uuid(), 'LANDLORD_1_UUID', 'Budget Bedsitter, Walking Distance to Campus',
    'Simple, affordable bedsitter for students on a tight budget.',
    950.00, 'ZMW', 'Munali, Lusaka', -15.3955, 28.3190,
    'bedsitter', '["water_included"]', 'pending'),

  (gen_random_uuid(), 'LANDLORD_2_UUID', 'Modern Single Room in Gated Complex',
    'Newly built gated complex with CCTV and 24-hour security.',
    2200.00, 'ZMW', 'Roma, Lusaka', -15.3870, 28.3260,
    'single', '["wifi", "cctv", "security_guard", "borehole_water", "parking"]', 'approved'),

  (gen_random_uuid(), 'LANDLORD_2_UUID', 'Quiet Shared Room for Female Students',
    'Female-only shared room, close to campus library entrance.',
    1300.00, 'ZMW', 'Kalundu, Lusaka', -15.3945, 28.3245,
    'shared', '["wifi", "water_included", "female_only"]', 'approved'),

  (gen_random_uuid(), 'LANDLORD_2_UUID', 'Spacious Self-Contained Unit with Study Desk',
    'Large room with built-in study desk and wardrobe, self-contained.',
    2900.00, 'ZMW', 'Woodlands, Lusaka', -15.4110, 28.3170,
    'self_contained', '["wifi", "private_bathroom", "study_desk", "backup_power"]', 'approved'),

  (gen_random_uuid(), 'LANDLORD_2_UUID', 'Affordable Bedsitter Close to Minibus Route',
    'On the main minibus route into campus, affordable rent.',
    1050.00, 'ZMW', 'Chelston, Lusaka', -15.3905, 28.3320,
    'bedsitter', '["water_included", "minibus_route"]', 'approved'),

  (gen_random_uuid(), 'LANDLORD_2_UUID', 'Single Room Awaiting Review',
    'Recently listed, still pending admin approval.',
    1700.00, 'ZMW', 'Kabulonga, Lusaka', -15.4030, 28.3120,
    'single', '["wifi"]', 'pending');

-- ---------------------------------------------------------------------
-- Property media — a couple of placeholder images per listing.
-- (Swap these for real Supabase Storage URLs once photo upload is built;
-- picsum.photos gives us stable, free placeholder images for now.)
-- ---------------------------------------------------------------------
insert into public.property_media (property_id, media_type, url, sort_order)
select p.id, 'image', 'https://picsum.photos/seed/' || substr(p.id::text, 1, 8) || '-a/800/600', 0
from public.properties p;

insert into public.property_media (property_id, media_type, url, sort_order)
select p.id, 'image', 'https://picsum.photos/seed/' || substr(p.id::text, 1, 8) || '-b/800/600', 1
from public.properties p;

-- ---------------------------------------------------------------------
-- Favourites — a few students shortlisting a few approved properties.
-- ---------------------------------------------------------------------
insert into public.favourites (student_id, property_id)
select 'STUDENT_1_UUID', p.id from public.properties p
where p.title = 'Sunny Single Room near Great East Road Campus';

insert into public.favourites (student_id, property_id)
select 'STUDENT_1_UUID', p.id from public.properties p
where p.title = 'Modern Single Room in Gated Complex';

insert into public.favourites (student_id, property_id)
select 'STUDENT_2_UUID', p.id from public.properties p
where p.title = 'Quiet Shared Room for Female Students';

insert into public.favourites (student_id, property_id)
select 'STUDENT_3_UUID', p.id from public.properties p
where p.title = 'Spacious Self-Contained Unit with Study Desk';

-- ---------------------------------------------------------------------
-- Reviews — a few honest-sounding reviews on approved properties.
-- ---------------------------------------------------------------------
insert into public.reviews (property_id, student_id, rating, comment)
select p.id, 'STUDENT_2_UUID', 5, 'Landlord is responsive and the room is exactly as pictured. Water is reliable.'
from public.properties p where p.title = 'Sunny Single Room near Great East Road Campus';

insert into public.reviews (property_id, student_id, rating, comment)
select p.id, 'STUDENT_4_UUID', 4, 'Good value for the price, a bit far from the main gate but shuttle helps.'
from public.properties p where p.title = 'Shared Room, 2 Students, Near Campus Shuttle Stop';

insert into public.reviews (property_id, student_id, rating, comment)
select p.id, 'STUDENT_1_UUID', 5, 'Loved the security here, felt very safe as a first-year.'
from public.properties p where p.title = 'Modern Single Room in Gated Complex';

insert into public.reviews (property_id, student_id, rating, comment)
select p.id, 'STUDENT_3_UUID', 3, 'Nice desk space but backup power only kicks in after a delay.'
from public.properties p where p.title = 'Spacious Self-Contained Unit with Study Desk';

-- ---------------------------------------------------------------------
-- Notifications — a couple of examples. In the real app these get
-- written by an Edge Function / trigger using the service role, but for
-- seed data we can insert directly (the SQL Editor runs as an elevated
-- role that isn't subject to RLS).
-- ---------------------------------------------------------------------
insert into public.notifications (user_id, message, is_read) values
  ('STUDENT_1_UUID', 'A new single room matching your saved search just went live near Great East Road Campus.', false),
  ('LANDLORD_2_UUID', 'Your listing "Single Room Awaiting Review" is pending admin approval.', false),
  ('LANDLORD_1_UUID', 'Your listing "Budget Bedsitter, Walking Distance to Campus" is pending admin approval.', false);
