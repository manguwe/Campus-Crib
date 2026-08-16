-- =========================================================================
-- Student Boarding House Finder — Profile privilege fix + suspension
-- Run this before 11_notifications.sql.
--
-- CRITICAL FIX: the "a user can update their own profile" policy from
-- 02_policies.sql only checked `id = auth.uid()` - it never restricted
-- WHICH columns could change. That means any logged-in user could run:
--   update public.profiles set role = 'admin' where id = auth.uid();
-- ...and grant themselves admin. This has been open since Phase 2. Same
-- fix pattern as landlord_profiles.verification_status and
-- properties.status: RLS can't do column-level diffs, so a trigger closes
-- it. This also adds the is_suspended column needed for the admin "suspend
-- a user" moderation action, protected the same way.
-- =========================================================================

alter table public.profiles
  add column if not exists is_suspended boolean not null default false;

comment on column public.profiles.is_suspended is 'Set by an admin to block a user from creating new listings/reviews. Does not revoke their login (that would need Supabase Auth admin API / an Edge Function, not just RLS).';

create or replace function public.protect_profile_privileged_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    return new; -- admins may change role / is_suspended freely
  end if;

  if new.role is distinct from old.role then
    raise exception 'Only an admin can change a user''s role';
  end if;

  if new.is_suspended is distinct from old.is_suspended then
    raise exception 'Only an admin can suspend or unsuspend a user';
  end if;

  return new;
end;
$$;

create trigger profiles_protect_privileged_fields
  before update on public.profiles
  for each row
  execute function public.protect_profile_privileged_fields();

-- ---------------------------------------------------------------------
-- Make suspension actually do something: a suspended landlord can't
-- create new listings, and a suspended student can't post new reviews.
-- (Existing listings/reviews aren't touched - suspension blocks new
-- writes, it doesn't retroactively hide anything. Extend this to other
-- tables later if you want a broader lockout.)
-- ---------------------------------------------------------------------
drop policy if exists "a verified landlord can create their own property" on public.properties;

create policy "a verified landlord can create their own property"
  on public.properties for insert
  to authenticated
  with check (
    landlord_id = auth.uid()
    and status = 'pending'
    and exists (
      select 1 from public.landlord_profiles lp
      where lp.id = auth.uid() and lp.verification_status = 'approved'
    )
    and not exists (
      select 1 from public.profiles p where p.id = auth.uid() and p.is_suspended
    )
  );

drop policy if exists "a student can write their own review" on public.reviews;

create policy "a student can write their own review"
  on public.reviews for insert
  to authenticated
  with check (
    student_id = auth.uid()
    and not exists (
      select 1 from public.profiles p where p.id = auth.uid() and p.is_suspended
    )
  );
