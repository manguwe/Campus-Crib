-- Campus Crib V16: Admin user contact visibility + direct WhatsApp/email helpers.
-- Run this AFTER the existing V12/V15 migrations.
--
-- Purpose:
-- 1) Keep the registered profile phone visible to admins.
-- 2) For landlords, fall back to the verified contact phone when the original
--    profile phone is empty (older accounts may have this situation).
-- 3) Return the landlord WhatsApp number when one was supplied during
--    verification. The frontend also supports the registered phone as the
--    WhatsApp target for direct admin outreach.
--
-- The function is intentionally admin-only and remains SECURITY DEFINER.

-- PostgreSQL does not allow CREATE OR REPLACE FUNCTION to change a function's
-- RETURNS TABLE shape, so drop the previous version before recreating it.
drop function if exists public.get_admin_user_directory();

create function public.get_admin_user_directory()
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
    coalesce(nullif(trim(p.phone), ''), nullif(trim(lp.contact_phone), ''))::text as phone,
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
  where public.is_admin()
  order by p.created_at desc;
$$;

grant execute on function public.get_admin_user_directory() to authenticated;

comment on function public.get_admin_user_directory() is
  'Admin-only directory including registered/fallback phone, auth email, and landlord contact details.';
