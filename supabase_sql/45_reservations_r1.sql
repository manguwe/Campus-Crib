-- 45_reservations_r1.sql
-- Reservations upgrade, stage 1: owner/agent response with a deadline, a reference code, and a timeline.
--
-- New flow:   student requests  ->  owner or agent accepts or declines within 24 hours (else the request expires)
--             ->  Campus Crib confirms (admin)  ->  confirmed.
-- Statuses are unchanged (pending, confirmed, rejected, cancelled, expired), so every existing screen keeps working.
-- Existing requests keep working: admins can use "Confirm anyway" when the owner has not responded.
-- Safe to run more than once. Run in the Supabase SQL Editor or with psql.

-- 1. New columns -------------------------------------------------------------------------
alter table public.reservations
  add column if not exists reference_code text,
  add column if not exists respond_by timestamptz,
  add column if not exists owner_response text check (owner_response in ('accepted', 'declined')),
  add column if not exists owner_note text,
  add column if not exists owner_responded_at timestamptz;

update public.reservations
set reference_code = 'CC-' || upper(substr(md5(id::text), 1, 8))
where reference_code is null;

create unique index if not exists reservations_reference_code_key on public.reservations (reference_code);

-- 2. Timeline ----------------------------------------------------------------------------
create table if not exists public.reservation_events (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  event text not null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists reservation_events_reservation_idx
  on public.reservation_events (reservation_id, created_at);

alter table public.reservation_events enable row level security;

drop policy if exists "reservation events readable by the people involved" on public.reservation_events;
create policy "reservation events readable by the people involved"
  on public.reservation_events for select to authenticated
  using (
    exists (
      select 1 from public.reservations r
      where r.id = reservation_events.reservation_id
        and (
          r.student_id = auth.uid()
          or public.is_admin()
          or exists (select 1 from public.properties p where p.id = r.property_id and p.landlord_id = auth.uid())
        )
    )
  );

revoke all on public.reservation_events from anon, authenticated;
grant select on public.reservation_events to authenticated;

-- 3. Automatic steps when a reservation is created or changes ---------------------------------
create or replace function public.reservations_before_insert_r1()
returns trigger
language plpgsql
as $$
begin
  if new.reference_code is null then
    new.reference_code := 'CC-' || upper(substr(md5(gen_random_uuid()::text), 1, 8));
  end if;
  if new.status = 'pending' and new.respond_by is null then
    new.respond_by := now() + interval '24 hours';
  end if;
  return new;
end;
$$;

drop trigger if exists reservations_before_insert_r1 on public.reservations;
create trigger reservations_before_insert_r1
  before insert on public.reservations
  for each row execute function public.reservations_before_insert_r1();

create or replace function public.reservations_after_insert_r1()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_landlord uuid;
  v_title text;
begin
  select landlord_id, title into v_landlord, v_title from public.properties where id = new.property_id;

  insert into public.reservation_events (reservation_id, actor_id, event, note)
  values (
    new.id,
    auth.uid(),
    case when new.status = 'confirmed' then 'confirmed_by_admin' else 'requested' end,
    new.student_note
  );

  if new.status = 'pending' and v_landlord is not null then
    insert into public.notifications (user_id, message)
    values (
      v_landlord,
      'New reservation request (' || coalesce(new.reference_code, '') || ') for "' || coalesce(v_title, 'your listing')
        || '". Please accept or decline within 24 hours.'
    );
  end if;

  return new;
end;
$$;

drop trigger if exists reservations_after_insert_r1 on public.reservations;
create trigger reservations_after_insert_r1
  after insert on public.reservations
  for each row execute function public.reservations_after_insert_r1();

-- Admins cannot confirm a request the owner has not accepted, unless they use "Confirm anyway".
create or replace function public.reservations_guard_confirm_r1()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'pending'
     and new.status = 'confirmed'
     and coalesce(new.owner_response, '') <> 'accepted'
     and coalesce(current_setting('campuscrib.confirm_override', true), '') <> 'on' then
    raise exception 'The owner or agent has not accepted this request yet. Use "Confirm anyway" only if you have agreed it with them directly.';
  end if;
  return new;
end;
$$;

drop trigger if exists reservations_guard_confirm_r1 on public.reservations;
create trigger reservations_guard_confirm_r1
  before update on public.reservations
  for each row execute function public.reservations_guard_confirm_r1();

create or replace function public.reservations_after_status_r1()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_landlord uuid;
  v_actor uuid := auth.uid();
begin
  if new.status is distinct from old.status then
    select landlord_id into v_landlord from public.properties where id = new.property_id;

    insert into public.reservation_events (reservation_id, actor_id, event, note)
    values (
      new.id,
      case when new.status = 'expired' then null else v_actor end,
      new.status,
      coalesce(new.admin_note, new.owner_note)
    );

    if new.status = 'cancelled' then
      if v_actor is distinct from new.student_id then
        insert into public.notifications (user_id, message)
        values (new.student_id, 'Your reservation (' || coalesce(new.reference_code, '') || ') was cancelled.');
      end if;
      if v_landlord is not null and v_actor is distinct from v_landlord then
        insert into public.notifications (user_id, message)
        values (v_landlord, 'A reservation (' || coalesce(new.reference_code, '') || ') on your listing was cancelled.');
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists reservations_after_status_r1 on public.reservations;
create trigger reservations_after_status_r1
  after update on public.reservations
  for each row execute function public.reservations_after_status_r1();

-- 4. Requests nobody answered expire (checked whenever someone opens the reservations screens) ------
create or replace function public.expire_stale_reservation_requests()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  with expired as (
    update public.reservations
    set status = 'expired', updated_at = now()
    where status = 'pending'
      and owner_response is null
      and respond_by is not null
      and respond_by < now()
    returning id, student_id, reference_code
  ),
  notified as (
    insert into public.notifications (user_id, message)
    select student_id,
           'Your reservation request (' || coalesce(reference_code, '') || ') expired because the owner did not respond in time. You can request another room.'
    from expired
    returning 1
  )
  select count(*) into v_count from expired;

  return v_count;
end;
$$;
revoke all on function public.expire_stale_reservation_requests() from public, anon;
grant execute on function public.expire_stale_reservation_requests() to authenticated;

-- 5. Owner or agent responds ----------------------------------------------------------------------
create or replace function public.owner_respond_reservation(
  p_reservation_id uuid,
  p_accept boolean,
  p_note text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.reservations%rowtype;
  v_title text;
  v_note text := nullif(trim(coalesce(p_note, '')), '');
begin
  if auth.uid() is null then
    raise exception 'You must be logged in.';
  end if;

  perform public.expire_stale_reservation_requests();

  select * into r from public.reservations where id = p_reservation_id for update;
  if not found then
    raise exception 'Reservation not found.';
  end if;

  select title into v_title from public.properties where id = r.property_id and landlord_id = auth.uid();
  if not found then
    raise exception 'Only the owner or agent of this listing can respond to the request.';
  end if;

  if r.status <> 'pending' then
    raise exception 'This request is no longer waiting for a response.';
  end if;
  if r.owner_response is not null then
    raise exception 'You have already responded to this request.';
  end if;

  if p_accept then
    update public.reservations
    set owner_response = 'accepted', owner_note = v_note, owner_responded_at = now()
    where id = r.id;

    insert into public.reservation_events (reservation_id, actor_id, event, note)
    values (r.id, auth.uid(), 'owner_accepted', v_note);

    insert into public.notifications (user_id, message)
    values (
      r.student_id,
      'The owner accepted your reservation request (' || coalesce(r.reference_code, '') || '). Campus Crib will confirm it shortly.'
    );
    perform public.notify_admins(
      'A reservation request (' || coalesce(r.reference_code, '') || ') was accepted by the owner and needs confirming.'
    );
  else
    update public.reservations
    set owner_response = 'declined', owner_note = v_note, owner_responded_at = now(), status = 'rejected'
    where id = r.id;

    insert into public.notifications (user_id, message)
    values (
      r.student_id,
      'The owner could not accept your reservation request (' || coalesce(r.reference_code, '') || '). You can request another room.'
    );
  end if;

  return true;
end;
$$;
revoke all on function public.owner_respond_reservation(uuid, boolean, text) from public, anon;
grant execute on function public.owner_respond_reservation(uuid, boolean, text) to authenticated;

-- 6. Admin override ------------------------------------------------------------------------------
create or replace function public.admin_confirm_reservation_anyway(
  p_reservation_id uuid,
  p_admin_note text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only an admin can confirm reservations.';
  end if;

  perform set_config('campuscrib.confirm_override', 'on', true);
  perform public.admin_confirm_reservation(p_reservation_id, p_admin_note);
  perform set_config('campuscrib.confirm_override', 'off', true);

  insert into public.reservation_events (reservation_id, actor_id, event, note)
  values (p_reservation_id, auth.uid(), 'override', 'Confirmed by an admin without a response from the owner or agent.');

  return true;
end;
$$;
revoke all on function public.admin_confirm_reservation_anyway(uuid, text) from public, anon;
grant execute on function public.admin_confirm_reservation_anyway(uuid, text) to authenticated;
