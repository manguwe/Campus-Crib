-- =========================================================================
-- Campus Crib — Listing availability status (available / on_hold / taken)
-- Run this in the Supabase SQL Editor.
--
-- Separate from `status` (the pending/approved/rejected moderation state,
-- admin-only via the properties_protect_status trigger in 02_policies.sql).
-- availability_status is a landlord-editable field, following the same
-- read/write RLS as the rest of the properties table - no policy changes
-- needed here.
-- =========================================================================

alter table public.properties
  add column if not exists availability_status text
  not null default 'available'
  check (availability_status in ('available', 'on_hold', 'taken'));

-- Explicit backfill for any existing NULLs, on top of what the default
-- above already handles for new rows.
update public.properties
set availability_status = 'available'
where availability_status is null;

-- Verify:
select availability_status, count(*) from public.properties group by availability_status;
