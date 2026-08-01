-- =========================================================================
-- Student Boarding House Finder — Backfill new detail fields on seed data
-- Run this AFTER 04_property_details_migration.sql.
-- Fills in building_type, occupancy, toilet_shared_by, and
-- walk_minutes_to_campus for the 9 existing seed properties, matched by
-- title, so demo data looks complete once Phase 4's filters go live.
-- =========================================================================

update public.properties set
  building_type = 'main_house', occupancy = 1, toilet_shared_by = 3, walk_minutes_to_campus = 5
where title = 'Sunny Single Room near Great East Road Campus';

update public.properties set
  building_type = 'boarding_house', occupancy = 2, toilet_shared_by = 6, walk_minutes_to_campus = 18
where title = 'Shared Room, 2 Students, Near Campus Shuttle Stop';

update public.properties set
  building_type = 'apartment', occupancy = 1, toilet_shared_by = 0, walk_minutes_to_campus = 15
where title = 'Self-Contained Bedsitter with Private Bathroom';

update public.properties set
  building_type = 'boarding_house', occupancy = 1, toilet_shared_by = 4, walk_minutes_to_campus = 8
where title = 'Budget Bedsitter, Walking Distance to Campus';

update public.properties set
  building_type = 'apartment', occupancy = 1, toilet_shared_by = 0, walk_minutes_to_campus = 10
where title = 'Modern Single Room in Gated Complex';

update public.properties set
  building_type = 'boarding_house', occupancy = 2, toilet_shared_by = 5, walk_minutes_to_campus = 10
where title = 'Quiet Shared Room for Female Students';

update public.properties set
  building_type = 'cottage', occupancy = 1, toilet_shared_by = 0, walk_minutes_to_campus = 25
where title = 'Spacious Self-Contained Unit with Study Desk';

update public.properties set
  building_type = 'main_house', occupancy = 1, toilet_shared_by = 3, walk_minutes_to_campus = 20
where title = 'Affordable Bedsitter Close to Minibus Route';

update public.properties set
  building_type = 'main_house', occupancy = 1, toilet_shared_by = 4, walk_minutes_to_campus = 15
where title = 'Single Room Awaiting Review';

-- Verify — every row should now have all four fields filled in:
select title, building_type, occupancy, toilet_shared_by, walk_minutes_to_campus
from public.properties
order by title;
