-- =========================================================================
-- Campus Crib — Admin-manageable campuses
-- Run this in the Supabase SQL Editor.
--
-- Replaces the hardcoded array in src/lib/campuses.js with a real table
-- an admin can manage. Seeded with the 3 campuses that were previously
-- hardcoded, using their existing real coordinates, so nothing changes
-- for existing users on first deploy.
--
-- properties.primary_campus_id is purely informational/labeling (see
-- Phase_Contact_Fix_And_Campus_Admin_Prompt.md item 4) - it does NOT
-- replace or feed into Browse's live distance calculation, which is
-- still computed directly from each property's own lat/lng against
-- whichever campus a student currently has selected in the filter, and
-- already works for any campus without needing this column at all.
-- =========================================================================

create table if not exists public.campuses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  latitude double precision not null,
  longitude double precision not null,
  is_active boolean not null default true,
  created_at timestamptz default now()
);

alter table public.campuses enable row level security;

-- Anyone, including anonymous/guest visitors, can see active campuses -
-- needed for the public Browse page's campus selector.
create policy "Anyone can view active campuses"
  on public.campuses for select
  using (is_active = true or public.is_admin());

create policy "Admins can insert campuses"
  on public.campuses for insert
  with check (public.is_admin());

create policy "Admins can update campuses"
  on public.campuses for update
  using (public.is_admin());

create policy "Admins can delete campuses"
  on public.campuses for delete
  using (public.is_admin());

-- Seed with the campuses that were previously hardcoded in
-- src/lib/campuses.js, using their existing real coordinates. Guarded so
-- re-running this migration doesn't duplicate rows.
insert into public.campuses (name, latitude, longitude)
select 'University of Zambia (UNZA), Great East Road Campus', -15.3947, 28.3322
where not exists (select 1 from public.campuses where name = 'University of Zambia (UNZA), Great East Road Campus');

insert into public.campuses (name, latitude, longitude)
select 'Eden University, Great East Road Campus', -15.3839536, 28.333008
where not exists (select 1 from public.campuses where name = 'Eden University, Great East Road Campus');

insert into public.campuses (name, latitude, longitude)
select 'Eden University, Barlastone Park Campus', -15.363446, 28.2336401
where not exists (select 1 from public.campuses where name = 'Eden University, Barlastone Park Campus');

-- Informational/labeling only, per the note above - nullable so existing
-- listings are completely unaffected. on delete set null: deactivating a
-- campus already just hides it from selectors (is_active = false); this
-- also covers the unlikely case of a hard delete without breaking any
-- listing that referenced it.
alter table public.properties
  add column if not exists primary_campus_id uuid references public.campuses(id) on delete set null;

-- Verify:
select id, name, latitude, longitude, is_active from public.campuses order by name;
