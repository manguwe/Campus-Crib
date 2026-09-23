-- =========================================================================
-- Student Boarding House Finder — Row Level Security
-- Run this AFTER 01_schema.sql. Enables RLS on every table and adds the
-- policies described in the project brief. Plain-language explanation of
-- each block is in the chat response / project notes — the comments here
-- are the short version.
-- =========================================================================

-- -------------------------------------------------------------------------
-- profiles
-- Everyone signed in can see basic profile info (needed to show a
-- landlord's name/phone on a listing, or a reviewer's name on a review).
-- A user can only create/edit their own row.
-- -------------------------------------------------------------------------
alter table public.profiles enable row level security;

create policy "profiles are readable by any authenticated user"
  on public.profiles for select
  to authenticated
  using (true);

create policy "a user can insert their own profile"
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid());

create policy "a user can update their own profile"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- No delete policy on purpose: profile rows are deleted automatically via
-- the "on delete cascade" from auth.users, not by end users directly.


-- -------------------------------------------------------------------------
-- landlord_profiles
-- This table holds an id_document_url — a link to someone's identity
-- document — so unlike most other tables it is NOT publicly readable.
-- Only the landlord themselves and admins can see it.
-- -------------------------------------------------------------------------
alter table public.landlord_profiles enable row level security;

create policy "a landlord can view their own verification record"
  on public.landlord_profiles for select
  to authenticated
  using (id = auth.uid() or public.is_admin());

create policy "a landlord can create their own verification record"
  on public.landlord_profiles for insert
  to authenticated
  with check (id = auth.uid());

create policy "a landlord or admin can update the verification record"
  on public.landlord_profiles for update
  to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- The UPDATE policy above allows a landlord to touch their own row (e.g.
-- re-upload id_document_url after a rejection), but we don't want them
-- approving themselves. A trigger enforces the column-level restriction
-- that RLS alone can't express ("only admins may change these 3 columns").
create or replace function public.protect_landlord_verification_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    if new.verification_status is distinct from old.verification_status
       or new.verified_at is distinct from old.verified_at
       or new.verified_by is distinct from old.verified_by then
      raise exception 'Only an admin can change verification_status, verified_at, or verified_by';
    end if;
  end if;
  return new;
end;
$$;

create trigger landlord_profiles_protect_verification
  before update on public.landlord_profiles
  for each row
  execute function public.protect_landlord_verification_fields();


-- -------------------------------------------------------------------------
-- properties
-- Public/anonymous visitors can browse approved listings. Landlords manage
-- only their own listings. Admins can see and moderate everything.
-- -------------------------------------------------------------------------
alter table public.properties enable row level security;

create policy "approved properties are public, owners and admins see all"
  on public.properties for select
  to anon, authenticated
  using (
    status = 'approved'
    or landlord_id = auth.uid()
    or public.is_admin()
  );

create policy "a verified landlord can create their own property"
  on public.properties for insert
  to authenticated
  with check (
    landlord_id = auth.uid()
    and exists (
      select 1 from public.landlord_profiles lp
      where lp.id = auth.uid() and lp.verification_status = 'approved'
    )
  );

create policy "a landlord or admin can update a property"
  on public.properties for update
  to authenticated
  using (landlord_id = auth.uid() or public.is_admin())
  with check (landlord_id = auth.uid() or public.is_admin());

create policy "a landlord or admin can delete a property"
  on public.properties for delete
  to authenticated
  using (landlord_id = auth.uid() or public.is_admin());

-- Same idea as landlord_profiles: landlords can edit their own listing's
-- details, but only an admin can flip its moderation status.
create or replace function public.protect_property_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    if new.status is distinct from old.status then
      raise exception 'Only an admin can change a property''s status';
    end if;
  end if;
  return new;
end;
$$;

create trigger properties_protect_status
  before update on public.properties
  for each row
  execute function public.protect_property_status();


-- -------------------------------------------------------------------------
-- property_media
-- Visible wherever the parent property is visible; manageable only by that
-- property's landlord (or an admin).
-- -------------------------------------------------------------------------
alter table public.property_media enable row level security;

create policy "media visible wherever its property is visible"
  on public.property_media for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.properties p
      where p.id = property_media.property_id
        and (p.status = 'approved' or p.landlord_id = auth.uid() or public.is_admin())
    )
  );

create policy "a landlord can add media to their own property"
  on public.property_media for insert
  to authenticated
  with check (
    exists (
      select 1 from public.properties p
      where p.id = property_media.property_id and p.landlord_id = auth.uid()
    )
    or public.is_admin()
  );

create policy "a landlord can update media on their own property"
  on public.property_media for update
  to authenticated
  using (
    exists (
      select 1 from public.properties p
      where p.id = property_media.property_id and p.landlord_id = auth.uid()
    )
    or public.is_admin()
  )
  with check (
    exists (
      select 1 from public.properties p
      where p.id = property_media.property_id and p.landlord_id = auth.uid()
    )
    or public.is_admin()
  );

create policy "a landlord can delete media on their own property"
  on public.property_media for delete
  to authenticated
  using (
    exists (
      select 1 from public.properties p
      where p.id = property_media.property_id and p.landlord_id = auth.uid()
    )
    or public.is_admin()
  );


-- -------------------------------------------------------------------------
-- favourites
-- Fully private to the student who created them (admins can view for
-- analytics, but never insert/delete on a student's behalf).
-- -------------------------------------------------------------------------
alter table public.favourites enable row level security;

create policy "a student can view their own favourites"
  on public.favourites for select
  to authenticated
  using (student_id = auth.uid() or public.is_admin());

create policy "a student can add their own favourites"
  on public.favourites for insert
  to authenticated
  with check (student_id = auth.uid());

create policy "a student can remove their own favourites"
  on public.favourites for delete
  to authenticated
  using (student_id = auth.uid());


-- -------------------------------------------------------------------------
-- reviews
-- Visible wherever the parent property is visible (plus the author, plus
-- admins for moderation). Only the author can write/edit; author or admin
-- can delete (admin moderation of abusive content).
-- -------------------------------------------------------------------------
alter table public.reviews enable row level security;

create policy "reviews visible wherever the property is visible"
  on public.reviews for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.properties p
      where p.id = reviews.property_id and p.status = 'approved'
    )
    or student_id = auth.uid()
    or public.is_admin()
  );

create policy "a student can write their own review"
  on public.reviews for insert
  to authenticated
  with check (student_id = auth.uid());

create policy "a student can edit their own review"
  on public.reviews for update
  to authenticated
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

create policy "a student or admin can delete a review"
  on public.reviews for delete
  to authenticated
  using (student_id = auth.uid() or public.is_admin());


-- -------------------------------------------------------------------------
-- notifications
-- Strictly private: a user can only ever see their own. There is
-- deliberately no INSERT policy for regular users below — notifications
-- are written by trusted server-side code (a Supabase Edge Function or
-- a database trigger) using the service_role key, which bypasses RLS
-- entirely. That keeps students/landlords from being able to spam
-- notifications into each other's inboxes directly from the client.
-- -------------------------------------------------------------------------
alter table public.notifications enable row level security;

create policy "a user can view their own notifications"
  on public.notifications for select
  to authenticated
  using (user_id = auth.uid());

create policy "a user can mark their own notifications read/unread"
  on public.notifications for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "a user can delete their own notifications"
  on public.notifications for delete
  to authenticated
  using (user_id = auth.uid());
