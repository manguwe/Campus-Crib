-- =========================================================================
-- Student Boarding House Finder — fix seed placeholder photos
-- Run this once if you already ran 03_seed.sql before this update: it
-- swaps out picsum.photos' random stock photos (which could show
-- anything - a beach, a phone on a desk - since picsum has no concept of
-- "house-related") for a neutral placehold.co image that actually reads
-- as "no real photo yet", on the 9 seed listings only.
--
-- Safe to run any time: it only touches rows whose url matches the old
-- picsum pattern, so real landlord-uploaded Supabase Storage URLs (which
-- look nothing like picsum.photos/...) are never touched.
-- =========================================================================

update public.property_media
set url = 'https://placehold.co/800x600/E2E8F0/1E293B?text=Photo+coming+soon'
where url like 'https://picsum.photos/%';
