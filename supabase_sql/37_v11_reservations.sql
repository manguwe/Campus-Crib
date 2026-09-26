-- =========================================================================
-- Campus Crib V11 — Reservations / room booking workflow
--
-- A listing represents a rentable room/unit. Students can request a
-- reservation with a move-in date; admin/agents can create or confirm a
-- reservation on behalf of a student. A confirmed reservation makes the
-- listing visibly reserved to other students until its move-out date (if
-- supplied). The database checks overlaps while locking the property row so
-- two admins/students cannot confirm the same room at the same time.
-- =========================================================================

create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  move_in_date date not null,
  move_out_date date,
  occupants integer not null default 1 check (occupants > 0),
  status text not null default 'pending'
    check (status in ('pending','confirmed','rejected','cancelled','expired')),
  student_note text,
  admin_note text,
  hold_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reservations_dates_valid check (move_out_date is null or move_out_date > move_in_date)
);

create index if not exists reservations_property_dates_idx
  on public.reservations(property_id, move_in_date, move_out_date, status);
create index if not exists reservations_student_idx
  on public.reservations(student_id, created_at desc);

-- Tracks which confirmed reservation put a listing into the existing
-- on_hold state. This prevents reservation cleanup from accidentally
-- changing a landlord's manually selected on-hold status.
alter table public.properties
  add column if not exists reservation_hold_id uuid references public.reservations(id) on delete set null;

create or replace function public.set_reservation_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists reservations_set_updated_at on public.reservations;
create trigger reservations_set_updated_at
before update on public.reservations
for each row execute function public.set_reservation_updated_at();

alter table public.reservations enable row level security;

-- Read own reservations, landlord reads reservations for their listings,
-- admins read everything. Mutations go through RPCs so overlap checks stay
-- server-side.
drop policy if exists reservations_select_own on public.reservations;
create policy reservations_select_own
on public.reservations for select
using (
  student_id = auth.uid()
  or public.is_admin()
  or exists (
    select 1 from public.properties p
    where p.id = reservations.property_id and p.landlord_id = auth.uid()
  )
);

revoke all on public.reservations from anon, authenticated;
grant select on public.reservations to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'reservations'
  ) then
    alter publication supabase_realtime add table public.reservations;
  end if;
end $$;

-- Expire old reservations. If a reservation has no move-out date, it stays
-- active until an admin cancels it; this is deliberate because many student
-- stays do not have a known end date at booking time.
create or replace function public.expire_finished_reservations()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  changed_count integer;
begin
  with expired as (
    update public.reservations
    set status = 'expired', updated_at = now()
    where status = 'confirmed'
      and move_out_date is not null
      and move_out_date < current_date
    returning id
  )
  update public.properties p
  set availability_status = 'available', reservation_hold_id = null
  where p.reservation_hold_id in (select id from expired);

  get diagnostics changed_count = row_count;
  return changed_count;
end;
$$;
grant execute on function public.expire_finished_reservations() to authenticated;

-- Public-safe reservation status: no student identity is exposed.
create or replace function public.get_property_reservation_status(p_property_id uuid)
returns table (
  is_reserved boolean,
  move_in_date date,
  move_out_date date,
  reservation_id uuid
)
language sql
security definer
set search_path = public
as $$
  select true, r.move_in_date, r.move_out_date, r.id
  from public.reservations r
  where r.property_id = p_property_id
    and r.status = 'confirmed'
    and r.move_in_date <= coalesce(r.move_out_date, '9999-12-31'::date)
    and (r.move_out_date is null or r.move_out_date >= current_date)
  order by r.move_in_date asc
  limit 1;
$$;
grant execute on function public.get_property_reservation_status(uuid) to anon, authenticated;

-- Student requests a room. It remains pending until an admin/agent confirms it.
create or replace function public.request_reservation(
  p_property_id uuid,
  p_move_in_date date,
  p_move_out_date date default null,
  p_occupants integer default 1,
  p_student_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  result_id uuid;
begin
  if auth.uid() is null then raise exception 'You must be logged in.'; end if;
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'student') then
    raise exception 'Only students can request a reservation.';
  end if;
  if p_move_in_date < current_date then raise exception 'Move-in date cannot be in the past.'; end if;
  if p_move_out_date is not null and p_move_out_date <= p_move_in_date then
    raise exception 'Move-out date must be after move-in date.';
  end if;
  if p_occupants < 1 then raise exception 'At least one occupant is required.'; end if;

  perform public.expire_finished_reservations();

  perform 1 from public.properties where id = p_property_id and status = 'approved' and availability_status = 'available' for update;
  if not found then raise exception 'This listing is not currently available for reservation.'; end if;

  if exists (
    select 1 from public.reservations r
    where r.property_id = p_property_id
      and r.status in ('pending','confirmed')
      and r.move_in_date < coalesce(p_move_out_date, '9999-12-31'::date)
      and coalesce(r.move_out_date, '9999-12-31'::date) > p_move_in_date
  ) then
    raise exception 'This room already has a reservation request or reservation covering those dates.';
  end if;

  insert into public.reservations (property_id, student_id, created_by, move_in_date, move_out_date, occupants, student_note)
  values (p_property_id, auth.uid(), auth.uid(), p_move_in_date, p_move_out_date, p_occupants, nullif(trim(p_student_note), ''))
  returning id into result_id;

  return result_id;
end;
$$;
grant execute on function public.request_reservation(uuid,date,date,integer,text) to authenticated;

-- Admin/agent creates a confirmed reservation on behalf of a student.
create or replace function public.admin_create_reservation(
  p_property_id uuid,
  p_student_id uuid,
  p_move_in_date date,
  p_move_out_date date default null,
  p_occupants integer default 1,
  p_admin_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  result_id uuid;
  landlord_id uuid;
begin
  if not public.is_admin() then raise exception 'Only an admin can create a reservation on behalf of a student.'; end if;
  if not exists (select 1 from public.profiles where id = p_student_id and role = 'student') then raise exception 'Selected user is not a student.'; end if;
  if p_move_in_date < current_date then raise exception 'Move-in date cannot be in the past.'; end if;
  if p_move_out_date is not null and p_move_out_date <= p_move_in_date then raise exception 'Move-out date must be after move-in date.'; end if;
  if p_occupants < 1 then raise exception 'At least one occupant is required.'; end if;

  perform public.expire_finished_reservations();

  select p.landlord_id into landlord_id from public.properties p
  where p.id = p_property_id and p.status = 'approved' and p.availability_status = 'available' for update;
  if landlord_id is null then raise exception 'This listing is not approved.'; end if;

  if exists (
    select 1 from public.reservations r
    where r.property_id = p_property_id
      and r.status = 'confirmed'
      and r.move_in_date < coalesce(p_move_out_date, '9999-12-31'::date)
      and coalesce(r.move_out_date, '9999-12-31'::date) > p_move_in_date
  ) then
    raise exception 'This room is already reserved for those dates.';
  end if;

  insert into public.reservations (property_id, student_id, created_by, move_in_date, move_out_date, occupants, status, admin_note)
  values (p_property_id, p_student_id, auth.uid(), p_move_in_date, p_move_out_date, p_occupants, 'confirmed', nullif(trim(p_admin_note), ''))
  returning id into result_id;

  update public.properties set availability_status = 'on_hold', reservation_hold_id = result_id where id = p_property_id;

  insert into public.notifications(user_id, message)
  values (p_student_id, 'Your room reservation has been confirmed. Move-in: ' || to_char(p_move_in_date, 'DD Mon YYYY') || '.')
  on conflict do nothing;

  insert into public.notifications(user_id, message)
  values (landlord_id, 'A reservation has been confirmed for your listing. Move-in: ' || to_char(p_move_in_date, 'DD Mon YYYY') || '.')
  on conflict do nothing;

  return result_id;
end;
$$;
grant execute on function public.admin_create_reservation(uuid,uuid,date,date,integer,text) to authenticated;

-- Admin confirms a student request.
create or replace function public.admin_confirm_reservation(
  p_reservation_id uuid,
  p_admin_note text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.reservations%rowtype;
  landlord_id uuid;
begin
  if not public.is_admin() then raise exception 'Only an admin can confirm reservations.'; end if;
  select * into r from public.reservations where id = p_reservation_id for update;
  if not found then raise exception 'Reservation not found.'; end if;
  if r.status <> 'pending' then raise exception 'Only pending reservations can be confirmed.'; end if;

  perform 1 from public.properties where id = r.property_id and status = 'approved' for update;
  if not found then raise exception 'The listing is no longer approved.'; end if;

  if exists (
    select 1 from public.reservations x
    where x.property_id = r.property_id and x.id <> r.id and x.status = 'confirmed'
      and x.move_in_date < coalesce(r.move_out_date, '9999-12-31'::date)
      and coalesce(x.move_out_date, '9999-12-31'::date) > r.move_in_date
  ) then
    raise exception 'This room has already been reserved for those dates.';
  end if;

  update public.reservations
  set status = 'confirmed', admin_note = coalesce(nullif(trim(p_admin_note), ''), admin_note), updated_at = now()
  where id = r.id;

  update public.properties set availability_status = 'on_hold', reservation_hold_id = r.id where id = r.property_id;
  select p.landlord_id into landlord_id from public.properties p where p.id = r.property_id;

  insert into public.notifications(user_id, message)
  values (r.student_id, 'Your reservation request has been confirmed. Move-in: ' || to_char(r.move_in_date, 'DD Mon YYYY') || '.');
  if landlord_id is not null then
    insert into public.notifications(user_id, message)
    values (landlord_id, 'A student reservation has been confirmed for your listing.');
  end if;

  return true;
end;
$$;
grant execute on function public.admin_confirm_reservation(uuid,text) to authenticated;

create or replace function public.admin_reject_reservation(
  p_reservation_id uuid,
  p_admin_note text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare r public.reservations%rowtype;
begin
  if not public.is_admin() then raise exception 'Only an admin can reject reservations.'; end if;
  select * into r from public.reservations where id = p_reservation_id for update;
  if not found then raise exception 'Reservation not found.'; end if;
  update public.reservations
  set status = 'rejected', admin_note = nullif(trim(p_admin_note), ''), updated_at = now()
  where id = r.id and status = 'pending';
  if not found then raise exception 'Only pending reservations can be rejected.'; end if;
  insert into public.notifications(user_id, message)
  values (r.student_id, 'Your reservation request was not approved.' || case when nullif(trim(p_admin_note), '') is not null then ' Note: ' || trim(p_admin_note) else '' end);
  return true;
end;
$$;
grant execute on function public.admin_reject_reservation(uuid,text) to authenticated;

create or replace function public.cancel_reservation(p_reservation_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare r public.reservations%rowtype;
begin
  select * into r from public.reservations where id = p_reservation_id for update;
  if not found then raise exception 'Reservation not found.'; end if;
  if auth.uid() <> r.student_id and not public.is_admin() and not exists (select 1 from public.properties p where p.id = r.property_id and p.landlord_id = auth.uid()) then
    raise exception 'You cannot cancel this reservation.';
  end if;
  if r.status not in ('pending','confirmed') then raise exception 'This reservation cannot be cancelled.'; end if;

  update public.reservations set status = 'cancelled', updated_at = now() where id = r.id;

  update public.properties p set availability_status = 'available', reservation_hold_id = null
  where p.id = r.property_id and p.reservation_hold_id = r.id;
  return true;
end;
$$;
grant execute on function public.cancel_reservation(uuid) to authenticated;
