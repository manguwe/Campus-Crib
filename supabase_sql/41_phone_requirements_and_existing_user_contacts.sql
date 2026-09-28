-- Campus Crib V17: required mobile numbers + safe self-service phone completion.
-- Run AFTER the existing V16/V15 migrations.
--
-- This fixes two related issues:
-- 1. The V6 landlord privacy trigger was storing new landlord phones only in
--    private_landlord_contacts, while the V16 admin directory did not read
--    that table.
-- 2. New registrations must now contain a valid mobile number. Existing
--    accounts without one can add it through update_my_phone().

-- -------------------------------------------------------------------------
-- Admin directory: read the registered phone from the correct private store.
-- -------------------------------------------------------------------------
create or replace function public.get_admin_user_directory()
returns table (
  id uuid,
  name text,
  role text,
  phone text,
  email text,
  created_at timestamptz,
  is_suspended boolean,
  suspension_reason text,
  suspended_until timestamptz,
  contact_phone text,
  contact_email text,
  whatsapp text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    p.id,
    p.name::text,
    p.role::text,
    coalesce(nullif(trim(p.phone), ''), nullif(trim(plc.phone), ''), nullif(trim(lp.contact_phone), ''))::text as phone,
    au.email::text,
    p.created_at,
    p.is_suspended,
    p.suspension_reason::text,
    p.suspended_until,
    lp.contact_phone::text,
    lp.contact_email::text,
    lp.contact_whatsapp::text
  from public.profiles p
  join auth.users au on au.id = p.id
  left join public.landlord_profiles lp on lp.id = p.id
  left join public.private_landlord_contacts plc on plc.landlord_id = p.id
  where public.is_admin()
  order by p.created_at desc;
$$;

grant execute on function public.get_admin_user_directory() to authenticated;

comment on function public.get_admin_user_directory() is
  'Admin-only directory with registered phone, private landlord phone fallback, verification contact details, and auth email.';

-- -------------------------------------------------------------------------
-- Existing users: secure RPC to add/change their own mobile number.
-- Landlord numbers remain in private_landlord_contacts; student/admin numbers
-- live on profiles.
-- -------------------------------------------------------------------------
create or replace function public.update_my_phone(p_phone text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_phone text := nullif(trim(coalesce(p_phone, '')), '');
  digits_only text;
  user_role text;
begin
  if auth.uid() is null then
    raise exception 'You must be logged in to update your mobile number';
  end if;

  digits_only := regexp_replace(coalesce(clean_phone, ''), '[^0-9]', '', 'g');

  if clean_phone is null or length(digits_only) < 7 or length(digits_only) > 15 then
    raise exception 'Please provide a valid mobile number';
  end if;

  select role into user_role
  from public.profiles
  where id = auth.uid();

  if user_role is null then
    raise exception 'Your Campus Crib profile could not be found';
  end if;

  if user_role = 'landlord' then
    insert into public.private_landlord_contacts(landlord_id, phone, updated_at)
    values (auth.uid(), clean_phone, now())
    on conflict (landlord_id)
    do update set phone = excluded.phone, updated_at = now();
  else
    update public.profiles
    set phone = clean_phone
    where id = auth.uid();
  end if;

  return clean_phone;
end;
$$;

grant execute on function public.update_my_phone(text) to authenticated;

-- Return only the current user's own phone. This avoids exposing phone
-- numbers to other authenticated users after the V6 privacy hardening.
create or replace function public.get_my_phone()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select case
    when p.role = 'landlord' then coalesce(plc.phone, lp.contact_phone)
    else p.phone
  end::text
  from public.profiles p
  left join public.private_landlord_contacts plc on plc.landlord_id = p.id
  left join public.landlord_profiles lp on lp.id = p.id
  where p.id = auth.uid();
$$;

grant execute on function public.get_my_phone() to authenticated;

-- -------------------------------------------------------------------------
-- Signup trigger: require a mobile number for all future accounts.
-- Landlord phone remains private; student/admin phone is stored on profiles.
-- Existing users are not modified by this trigger.
-- -------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_role text := coalesce(new.raw_user_meta_data ->> 'role', 'student');
  new_phone text := nullif(trim(new.raw_user_meta_data ->> 'phone'), '');
  digits_only text;
begin
  digits_only := regexp_replace(coalesce(new_phone, ''), '[^0-9]', '', 'g');

  if new_phone is null or length(digits_only) < 7 or length(digits_only) > 15 then
    raise exception 'A valid mobile number is required to create a Campus Crib account';
  end if;

  if new_role not in ('student', 'landlord', 'admin') then
    raise exception 'Invalid Campus Crib account role';
  end if;

  insert into public.profiles (id, name, role, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', 'New User'),
    new_role,
    case when new_role = 'landlord' then null else new_phone end
  )
  on conflict (id) do update set
    name = excluded.name,
    role = excluded.role,
    phone = case when excluded.role = 'landlord' then public.profiles.phone else excluded.phone end;

  if new_role = 'landlord' then
    insert into public.private_landlord_contacts(landlord_id, phone, updated_at)
    values (new.id, new_phone, now())
    on conflict (landlord_id)
    do update set phone = excluded.phone, updated_at = now();
  end if;

  return new;
end;
$$;
