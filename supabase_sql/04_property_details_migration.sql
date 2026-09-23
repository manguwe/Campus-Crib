-- =========================================================================
-- Student Boarding House Finder — Additional property detail columns
-- Run this in the Supabase SQL Editor.
--
-- Adds fields students actually search by that don't fit cleanly into the
-- generic amenities list: building type, how many people a room fits,
-- toilet sharing, and the landlord's own walk-time estimate to campus.
-- =========================================================================

alter table public.properties
  add column if not exists building_type text
    check (building_type in ('apartment', 'cottage', 'main_house', 'boarding_house', 'other')),
  add column if not exists occupancy integer
    check (occupancy is null or occupancy > 0),
  add column if not exists toilet_shared_by integer
    check (toilet_shared_by is null or toilet_shared_by >= 0),
  -- toilet_shared_by = 0 or null means private/not shared; a number means
  -- shared by that many people
  add column if not exists walk_minutes_to_campus integer
    check (walk_minutes_to_campus is null or walk_minutes_to_campus >= 0);

comment on column public.properties.building_type is
  'Type of structure: apartment, cottage, main_house, boarding_house, or other';
comment on column public.properties.occupancy is
  'How many people the room/unit is designed to accommodate';
comment on column public.properties.toilet_shared_by is
  'Number of people sharing the toilet/bathroom; null or 0 means private';
comment on column public.properties.walk_minutes_to_campus is
  'Landlord-estimated walk time to campus in minutes (not GPS-calculated)';

-- Verify the new columns exist:
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'properties'
  and column_name in ('building_type', 'occupancy', 'toilet_shared_by', 'walk_minutes_to_campus');
