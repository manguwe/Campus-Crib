-- =========================================================================
-- Student Boarding House Finder — Notifications
-- Run after 10_profile_privilege_fix_and_suspension.sql.
--
-- Adds a rejection_reason column to both landlord_profiles and properties
-- (so "approve/reject with a reason" has somewhere to live), protects it
-- the same way verification_status/status are already protected, and adds
-- two AFTER UPDATE triggers that insert a notifications row whenever an
-- admin approves/rejects a landlord or a listing. These triggers are
-- SECURITY DEFINER (same pattern as is_admin()) so the INSERT into
-- notifications succeeds even though there's still no client-facing
-- INSERT policy on that table (see 02_policies.sql) - the whole point is
-- that only trusted server-side code, like this trigger, can write
-- notifications, never the client directly.
-- =========================================================================

alter table public.landlord_profiles add column if not exists rejection_reason text;
alter table public.properties add column if not exists rejection_reason text;

-- ---- extend existing protection triggers to also guard rejection_reason ----

create or replace function public.protect_landlord_verification_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    return new;
  end if;

  if new.verification_status is distinct from old.verification_status then
    if new.verification_status <> 'pending' then
      raise exception 'Only an admin can approve or reject a landlord verification';
    end if;
  end if;

  -- Non-admin changes (e.g. re-uploading a document) always clear the
  -- previous admin decision so stale approval/rejection metadata can't
  -- linger against a resubmitted document.
  new.verified_at := null;
  new.verified_by := null;
  new.rejection_reason := null;

  return new;
end;
$$;

create or replace function public.protect_property_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    if new.status is distinct from old.status or new.rejection_reason is distinct from old.rejection_reason then
      raise exception 'Only an admin can change a property''s status or rejection reason';
    end if;
  end if;
  return new;
end;
$$;

-- ---- notification triggers ----

create or replace function public.notify_landlord_verification_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.verification_status = 'approved' then
    insert into public.notifications (user_id, message)
    values (new.id, 'Your landlord verification has been approved. You can now create property listings.');
  elsif new.verification_status = 'rejected' then
    insert into public.notifications (user_id, message)
    values (
      new.id,
      'Your landlord verification was rejected.'
      || case when coalesce(new.rejection_reason, '') <> '' then ' Reason: ' || new.rejection_reason else '' end
    );
  end if;
  return new;
end;
$$;

drop trigger if exists landlord_profiles_notify_verification on public.landlord_profiles;
create trigger landlord_profiles_notify_verification
  after update on public.landlord_profiles
  for each row
  when (new.verification_status is distinct from old.verification_status)
  execute function public.notify_landlord_verification_change();

create or replace function public.notify_property_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'approved' then
    insert into public.notifications (user_id, message)
    values (new.landlord_id, 'Your listing "' || new.title || '" has been approved and is now live.');
  elsif new.status = 'rejected' then
    insert into public.notifications (user_id, message)
    values (
      new.landlord_id,
      'Your listing "' || new.title || '" was rejected.'
      || case when coalesce(new.rejection_reason, '') <> '' then ' Reason: ' || new.rejection_reason else '' end
    );
  end if;
  return new;
end;
$$;

drop trigger if exists properties_notify_status_change on public.properties;
create trigger properties_notify_status_change
  after update on public.properties
  for each row
  when (new.status is distinct from old.status)
  execute function public.notify_property_status_change();

-- ---- enable Realtime on notifications, so the frontend bell can use a
-- live subscription instead of polling. Safe to run even if it's already
-- enabled (checks first rather than erroring on a duplicate ADD TABLE). ----
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
