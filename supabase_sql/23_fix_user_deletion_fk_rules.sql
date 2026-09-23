-- =========================================================================
-- Campus Crib — Fix missing ON DELETE rules blocking user deletion
-- Run this in the Supabase SQL Editor.
--
-- Deleting a user from Authentication -> Users was failing with
-- "Database error deleting user" because at least one FK referencing
-- profiles(id) had no ON DELETE rule, so Postgres defaulted to
-- RESTRICT/NO ACTION and blocked the delete with a foreign key
-- violation once profiles.id (which itself cascades from auth.users)
-- tried to cascade-delete.
--
-- Every foreign key across every migration in this project that
-- references auth.users(id) or public.profiles(id) was checked (01,
-- 07, 08, 19; nothing else in 02-06, 09-18, 20-22 adds one). Three were
-- missing an ON DELETE rule:
--   - landlord_profiles.verified_by  -> an admin's own action on
--     someone else's record. Deleting that admin should never be
--     blocked, and should never delete the landlord's verification
--     record - just null out who verified it.        => SET NULL
--   - feedback.submitted_by          -> the feedback itself is still
--     useful even if the submitter's account is later deleted; it
--     shouldn't vanish, just lose the identity link.  => SET NULL
--   - activity_logs.user_id          -> purely a per-user activity
--     trail; there's no reason to keep orphaned rows once the user
--     themselves is gone.                              => CASCADE
--
-- Everything else that already had CASCADE or SET NULL (profiles.id,
-- landlord_profiles.id, favourites.student_id, reviews.student_id,
-- notifications.user_id, property_reports.reporter_id) is left
-- untouched - only the three genuinely missing a rule are changed.
--
-- Each fix below looks up the constraint's ACTUAL current name from
-- pg_constraint rather than assuming Postgres's default
-- <table>_<column>_fkey naming, so this runs correctly regardless of
-- how the constraint actually ended up named on the live database.
-- =========================================================================

do $$
declare
  conname text;
begin
  select con.conname into conname
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_attribute att on att.attrelid = con.conrelid and att.attnum = any(con.conkey)
  where con.contype = 'f'
    and rel.relname = 'landlord_profiles'
    and att.attname = 'verified_by';

  if conname is not null then
    execute format('alter table public.landlord_profiles drop constraint %I', conname);
  end if;

  alter table public.landlord_profiles
    add constraint landlord_profiles_verified_by_fkey
    foreign key (verified_by) references public.profiles(id) on delete set null;
end $$;

do $$
declare
  conname text;
begin
  select con.conname into conname
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_attribute att on att.attrelid = con.conrelid and att.attnum = any(con.conkey)
  where con.contype = 'f'
    and rel.relname = 'feedback'
    and att.attname = 'submitted_by';

  if conname is not null then
    execute format('alter table public.feedback drop constraint %I', conname);
  end if;

  alter table public.feedback
    add constraint feedback_submitted_by_fkey
    foreign key (submitted_by) references public.profiles(id) on delete set null;
end $$;

do $$
declare
  conname text;
begin
  select con.conname into conname
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_attribute att on att.attrelid = con.conrelid and att.attnum = any(con.conkey)
  where con.contype = 'f'
    and rel.relname = 'activity_logs'
    and att.attname = 'user_id';

  if conname is not null then
    execute format('alter table public.activity_logs drop constraint %I', conname);
  end if;

  alter table public.activity_logs
    add constraint activity_logs_user_id_fkey
    foreign key (user_id) references public.profiles(id) on delete cascade;
end $$;

-- Verify: every FK referencing profiles(id) or auth.users(id) and its
-- delete rule (c = no action, a = no action, r = restrict, n = set
-- null, d = set default, ca = cascade under confdeltype... Postgres
-- reports this as a single char in confdeltype: a/r/c/n/d).
select
  con.conname,
  rel.relname as table_name,
  att.attname as column_name,
  case con.confdeltype
    when 'a' then 'NO ACTION'
    when 'r' then 'RESTRICT'
    when 'c' then 'CASCADE'
    when 'n' then 'SET NULL'
    when 'd' then 'SET DEFAULT'
  end as on_delete
from pg_constraint con
join pg_class rel on rel.oid = con.conrelid
join pg_class frel on frel.oid = con.confrelid
join pg_attribute att on att.attrelid = con.conrelid and att.attnum = any(con.conkey)
where con.contype = 'f'
  and frel.relname in ('profiles', 'users')
order by table_name, column_name;
