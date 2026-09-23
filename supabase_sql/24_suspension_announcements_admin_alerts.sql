-- =========================================================================
-- Campus Crib — Suspension overhaul, admin announcements, admin alerting
-- Run this in the Supabase SQL Editor.
--
-- PART 3 NOTE (no schema change here): the brief asked to check whether
-- `properties` already has a moderation/approval column before adding
-- one. It already does - `status` (pending/approved/rejected, added in
-- 01_schema.sql), already defaults new rows to 'pending', already has
-- RLS restricting non-owner/non-admin SELECT to 'approved' only (see
-- "approved properties are public, owners and admins see all" in
-- 02_policies.sql), already has a full Approve/Reject queue in
-- AdminProperties.jsx, and already notifies the landlord on both
-- decisions (notify_property_status_change(), 11_notifications.sql).
-- Adding a second `moderation_status` column would create two competing
-- systems, so this migration does NOT add one - Part 3 was already done
-- by earlier work. The one genuine gap (no ADMIN notification when a
-- listing first enters 'pending') is fixed below, under Part 6.
-- =========================================================================


-- =========================================================================
-- PART 4: Suspension - reason, duration, and a working enforcement point
-- =========================================================================

alter table public.profiles
  add column if not exists suspension_reason text,
  add column if not exists suspended_until timestamptz; -- null = indefinite

comment on column public.profiles.suspended_until is 'null while not suspended AND while suspended indefinitely - distinguish the two via is_suspended. A non-null value in the past means the suspension period has lapsed (the frontend treats this as no-longer-suspended; nothing auto-flips is_suspended back without an admin/cron, since this project has no scheduled jobs).';

-- Extend the existing privileged-fields guard (was already blocking
-- non-admins from touching is_suspended) to also cover the two new
-- columns, so only an admin can set a suspension reason or duration -
-- same protection, same trigger, just a wider column list.
create or replace function public.protect_profile_privileged_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    return new; -- admins may change role / is_suspended / suspension fields freely
  end if;

  if new.role is distinct from old.role then
    raise exception 'Only an admin can change a user''s role';
  end if;

  if new.is_suspended is distinct from old.is_suspended
     or new.suspension_reason is distinct from old.suspension_reason
     or new.suspended_until is distinct from old.suspended_until then
    raise exception 'Only an admin can suspend or unsuspend a user';
  end if;

  return new;
end;
$$;

-- Notifies the user when an admin suspends or unsuspends them - same
-- AFTER UPDATE + is_distinct-from-old pattern as the existing
-- verification/listing-status notification triggers.
create or replace function public.notify_suspension_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_suspended and not old.is_suspended then
    insert into public.notifications (user_id, message)
    values (
      new.id,
      'Your account has been suspended'
      || case when coalesce(new.suspension_reason, '') <> '' then ': ' || new.suspension_reason else '' end
      || case
           when new.suspended_until is not null then ' until ' || to_char(new.suspended_until, 'DD Mon YYYY')
           else ' indefinitely'
         end
      || '. Contact support to resolve this.'
    );
  elsif old.is_suspended and not new.is_suspended then
    insert into public.notifications (user_id, message)
    values (new.id, 'Your account suspension has been lifted. You can use Campus Crib again.');
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_notify_suspension_change on public.profiles;
create trigger profiles_notify_suspension_change
  after update on public.profiles
  for each row
  when (new.is_suspended is distinct from old.is_suspended)
  execute function public.notify_suspension_change();


-- =========================================================================
-- PART 5: Admin announcements (broadcast notifications)
-- =========================================================================

-- Distinguishes a broadcast announcement from every other notification
-- type already inserted by this project's triggers (verification,
-- listing status, suspension) - those are left as type = null / default,
-- so this is purely additive and doesn't touch any existing row.
alter table public.notifications
  add column if not exists type text;

-- SECURITY DEFINER RPC rather than a client-side bulk insert, because
-- notifications deliberately has NO client-facing INSERT policy at all
-- (see 02_policies.sql) - the same reason every other "system" notification
-- in this project is written by a trigger, not by app code. Checks
-- is_admin() itself, so granting EXECUTE to `authenticated` is safe.
create or replace function public.admin_broadcast_announcement(p_audience text, p_message text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  if not public.is_admin() then
    raise exception 'Admins only';
  end if;

  if p_audience not in ('all', 'student', 'landlord') then
    raise exception 'Invalid audience: %', p_audience;
  end if;

  if coalesce(trim(p_message), '') = '' then
    raise exception 'Message cannot be empty';
  end if;

  insert into public.notifications (user_id, message, type)
  select id, p_message, 'announcement'
  from public.profiles
  where p_audience = 'all' or role = p_audience;

  get diagnostics affected = row_count;
  return affected;
end;
$$;

grant execute on function public.admin_broadcast_announcement(text, text) to authenticated;


-- =========================================================================
-- PART 6: Admin alerting - notify every admin for the events that were
-- silently producing nothing before. One shared helper, reused by each
-- trigger below, so every admin (profiles.role = 'admin') gets their own
-- notifications row - matching how notifications already work for every
-- other user (per-recipient rows; there's no broadcast/shared-row concept
-- in this schema - see PART 5 above, which uses the same per-row approach).
-- =========================================================================

create or replace function public.notify_admins(p_message text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, message)
  select id, p_message from public.profiles where role = 'admin';
end;
$$;

-- 6a. New listing entering 'pending' moderation (i.e. every new listing,
-- since 'pending' is the default - see the PART 3 note above).
create or replace function public.notify_admins_new_pending_property()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'pending' then
    perform public.notify_admins('New listing awaiting review: "' || new.title || '"');
  end if;
  return new;
end;
$$;

drop trigger if exists properties_notify_admins_pending on public.properties;
create trigger properties_notify_admins_pending
  after insert on public.properties
  for each row
  execute function public.notify_admins_new_pending_property();

-- 6b. A landlord verification submission - fires on UPDATE (never on the
-- initial signup INSERT, which has no documents yet) whenever the row
-- lands back in 'pending' with at least one document attached - covers
-- both a first-time submission and a resubmission after rejection.
create or replace function public.notify_admins_landlord_submission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.verification_status = 'pending'
     and (new.id_document_front_url is not null or new.id_document_url is not null) then
    perform public.notify_admins('New landlord verification submitted for review.');
  end if;
  return new;
end;
$$;

drop trigger if exists landlord_profiles_notify_admins_submission on public.landlord_profiles;
create trigger landlord_profiles_notify_admins_submission
  after update on public.landlord_profiles
  for each row
  execute function public.notify_admins_landlord_submission();

-- 6c. A new contact_messages submission.
create or replace function public.notify_admins_new_contact_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.notify_admins('New contact message from ' || new.name || '.');
  return new;
end;
$$;

drop trigger if exists contact_messages_notify_admins on public.contact_messages;
create trigger contact_messages_notify_admins
  after insert on public.contact_messages
  for each row
  execute function public.notify_admins_new_contact_message();

-- 6d. A new property_reports flag.
create or replace function public.notify_admins_new_report()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.notify_admins('A listing was reported (' || new.reason || ').');
  return new;
end;
$$;

drop trigger if exists property_reports_notify_admins on public.property_reports;
create trigger property_reports_notify_admins
  after insert on public.property_reports
  for each row
  execute function public.notify_admins_new_report();

-- 6e. A new feedback submission.
create or replace function public.notify_admins_new_feedback()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.notify_admins('New feedback submitted.');
  return new;
end;
$$;

drop trigger if exists feedback_notify_admins on public.feedback;
create trigger feedback_notify_admins
  after insert on public.feedback
  for each row
  execute function public.notify_admins_new_feedback();

-- Verify:
select tgname, tgrelid::regclass as table_name
from pg_trigger
where tgname like '%notify_admin%' or tgname = 'profiles_notify_suspension_change'
order by table_name;
