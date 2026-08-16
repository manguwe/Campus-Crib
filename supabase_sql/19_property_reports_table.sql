-- =========================================================================
-- Campus Crib — Report a listing (property_reports)
-- Run this in the Supabase SQL Editor.
--
-- Lets a logged-in student flag a listing as fake, misleading,
-- inappropriate, or fraudulent. Mirrors the feedback / contact_messages
-- RLS pattern: anyone (here: any authenticated user) can insert, only
-- admins can read or update. Reuses the existing public.is_admin()
-- helper from 01_schema.sql rather than re-deriving the same check.
--
-- Note: the brief asked for this to be numbered 18_property_reports_
-- table.sql, but 18_property_availability_status.sql already exists in
-- this project from an earlier phase, so this is 19_ instead to keep
-- migration numbers unique and in run order.
-- =========================================================================

create table if not exists public.property_reports (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  reporter_id uuid references public.profiles(id) on delete set null,
  reason text not null check (
    reason in ('fake_listing', 'misleading_info', 'inappropriate_content', 'scam_or_fraud', 'other')
  ),
  details text,
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'dismissed')),
  created_at timestamptz not null default now()
);

alter table public.property_reports enable row level security;

-- Any authenticated user can submit a report, but only as themselves -
-- reporter_id must match their own auth.uid() (unlike feedback/
-- contact_messages, this isn't open to anonymous submissions, since the
-- feature is gated to logged-in students on the frontend).
create policy "Authenticated users can submit a report"
  on public.property_reports for insert
  to authenticated
  with check (reporter_id = auth.uid());

-- A reporter can see their own reports (used to check for an existing
-- pending report on a listing before showing the report option again),
-- and admins can see all of them (the moderation queue).
create policy "Reporters can read their own reports, admins can read all"
  on public.property_reports for select
  using (reporter_id = auth.uid() or public.is_admin());

-- Only admins can update a report (mark reviewed / dismissed).
create policy "Admins can update reports"
  on public.property_reports for update
  using (public.is_admin());

create index if not exists property_reports_property_id_idx on public.property_reports(property_id);
create index if not exists property_reports_status_idx on public.property_reports(status);

-- Verify:
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'property_reports'
order by ordinal_position;
