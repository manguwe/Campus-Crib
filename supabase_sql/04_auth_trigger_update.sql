-- =========================================================================
-- Student Boarding House Finder — Auth trigger update
-- Run this AFTER 01_schema.sql / 02_policies.sql / 03_seed.sql are already
-- in place. Safe to run multiple times (CREATE OR REPLACE).
--
-- WHY: registration needs to write two rows for a landlord signup
-- (profiles + landlord_profiles) and one row for a student (profiles
-- only). Doing the second insert from the frontend after signUp() is
-- fragile — if the browser tab closes, the network drops, or the user's
-- email needs confirming before a session exists, that second insert may
-- never happen, leaving a landlord with a profile but no verification
-- record (and no way to ever create a property, since the RLS policy on
-- properties checks landlord_profiles). Doing it inside the same
-- Postgres trigger that already fires on auth.users insert guarantees
-- both rows are created together, server-side, no matter what the
-- client does afterwards.
-- =========================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  v_role := coalesce(new.raw_user_meta_data ->> 'role', 'student');

  insert into public.profiles (id, name, role, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', 'New User'),
    v_role,
    new.raw_user_meta_data ->> 'phone'
  )
  on conflict (id) do nothing;

  if v_role = 'landlord' then
    insert into public.landlord_profiles (id)
    values (new.id)
    on conflict (id) do nothing;
  end if;

  return new;
end;
$$;

-- No need to touch the trigger itself (on_auth_user_created from
-- 01_schema.sql) — it already points at this function by name, so
-- CREATE OR REPLACE is all that's needed to pick up the new behaviour.
