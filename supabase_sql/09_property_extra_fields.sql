-- =========================================================================
-- Student Boarding House Finder — Extra property fields
-- You mentioned you've already added these columns yourself - this file
-- is here so the schema history stays complete and reproducible for
-- anyone rebuilding the database from scratch. Safe to run even if the
-- columns already exist (IF NOT EXISTS).
-- =========================================================================

alter table public.properties
  add column if not exists building_type text
    check (building_type in ('apartment', 'cottage', 'main_house', 'boarding_house', 'other')),
  add column if not exists occupancy int
    check (occupancy is null or occupancy > 0),
  add column if not exists toilet_shared_by int
    check (toilet_shared_by is null or toilet_shared_by >= 0),
  add column if not exists walk_minutes_to_campus int
    check (walk_minutes_to_campus is null or walk_minutes_to_campus >= 0);

comment on column public.properties.building_type is 'Kind of building the room/unit is in.';
comment on column public.properties.occupancy is 'How many people this room/unit is designed for.';
comment on column public.properties.toilet_shared_by is 'Number of people sharing the toilet/bathroom. NULL or 0 = private.';
comment on column public.properties.walk_minutes_to_campus is 'Landlord''s own estimate of walking time to campus, in minutes.';

-- All four are nullable, so existing rows (including seed data from
-- 03_seed.sql) remain valid without needing a backfill.
