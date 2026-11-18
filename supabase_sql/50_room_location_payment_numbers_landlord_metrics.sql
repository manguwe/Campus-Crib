-- 50_room_location_payment_numbers_landlord_metrics.sql
-- Additive only: new table and new functions. Nothing existing is renamed, dropped or altered.
--
-- 1. reservation_payment_numbers  - mobile money numbers shown to students after the admin accepts a request.
--                                    Added manually by the admin (SQL editor or the Supabase table editor).
-- 2. student_can_view_room_directions(room) - true only for a student whose reservation is confirmed
--                                    and whose payment proof is verified (or payments are switched off).
--                                    The room's landlord and admins also get true.
-- 3. landlord_room_metrics(days)   - per-room figures for the landlord dashboard: status, availability,
--                                    page views in the window (null = all time), admin-confirmed reservations.
-- Safe to run more than once.

-- 1. Payment numbers ----------------------------------------------------------------------------
create table if not exists public.reservation_payment_numbers (
  id           uuid primary key default gen_random_uuid(),
  network      text not null,            -- e.g. 'MTN', 'Airtel', 'Zamtel'
  phone        text not null,            -- the mobile money number students send to
  account_name text,                     -- name registered on that number
  is_active    boolean not null default true,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now()
);

alter table public.reservation_payment_numbers enable row level security;

drop policy if exists "payment numbers readable by signed-in users" on public.reservation_payment_numbers;
create policy "payment numbers readable by signed-in users"
  on public.reservation_payment_numbers for select
  to authenticated
  using (is_active or public.is_admin());

drop policy if exists "payment numbers managed by admins" on public.reservation_payment_numbers;
create policy "payment numbers managed by admins"
  on public.reservation_payment_numbers for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 2. Directions access -------------------------------------------------------------------------
create or replace function public.student_can_view_room_directions(p_property_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1 from public.properties p
      where p.id = p_property_id and p.landlord_id = auth.uid()
    )
    or public.is_admin()
    or exists (
      select 1 from public.reservations r
      where r.property_id = p_property_id
        and r.student_id = auth.uid()
        and r.status = 'confirmed'
        and r.payment_status in ('verified', 'not_required')
    );
$$;

revoke all on function public.student_can_view_room_directions(uuid) from public, anon;
grant execute on function public.student_can_view_room_directions(uuid) to authenticated;

-- 3. Landlord room metrics ----------------------------------------------------------------------
-- p_days = 7 for weekly, 30 for monthly, null for all time. Views count every page_view row for the room.
create or replace function public.landlord_room_metrics(p_days integer default null)
returns table (
  property_id uuid,
  title text,
  status text,
  availability_status text,
  views bigint,
  confirmed_reservations bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.title,
    p.status,
    p.availability_status,
    (
      select count(*) from public.activity_logs al
      where al.event_type = 'page_view'
        and al.path = '/properties/' || p.id::text
        and (p_days is null or al.created_at >= now() - make_interval(days => p_days))
    ),
    (
      select count(*) from public.reservations r
      where r.property_id = p.id and r.status = 'confirmed'
    )
  from public.properties p
  where p.landlord_id = auth.uid()
  order by p.created_at desc;
$$;

revoke all on function public.landlord_room_metrics(integer) from public, anon;
grant execute on function public.landlord_room_metrics(integer) to authenticated;
