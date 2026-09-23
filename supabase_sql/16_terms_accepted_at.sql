-- =========================================================================
-- Campus Crib — record Terms of Service acceptance at signup (OPTIONAL)
--
-- The Terms checkbox on RegisterStudent/RegisterLandlord is enforced
-- client-side (the submit button is disabled until it's checked), so this
-- migration is polish, not a required gate. It adds a nullable
-- `terms_accepted_at` column to `profiles` and updates handle_new_user()
-- to populate it from the `terms_accepted_at` ISO timestamp the frontend
-- already sends in signUp()'s raw_user_meta_data (see AuthContext.jsx).
-- Safe to run multiple times (ADD COLUMN IF NOT EXISTS / CREATE OR REPLACE).
-- =========================================================================

alter table public.profiles
  add column if not exists terms_accepted_at timestamptz;

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

  insert into public.profiles (id, name, role, phone, terms_accepted_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', 'New User'),
    v_role,
    new.raw_user_meta_data ->> 'phone',
    (new.raw_user_meta_data ->> 'terms_accepted_at')::timestamptz
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
-- 01_schema.sql, or on_auth_user_email_confirmed if you've applied
-- 15_defer_profile_creation_to_email_confirmation.sql) - both already
-- point at this function by name, so CREATE OR REPLACE is all that's
-- needed to pick up the new column.
