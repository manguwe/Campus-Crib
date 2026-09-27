-- Campus Crib V12 — reservation conversations + admin contact directory
-- Run after V11 (37), and after V10's conversation cleanup (36).

-- 1) Conversations can be tied directly to a reservation or be a private
--    admin-to-user conversation.
alter table public.conversations
  add column if not exists reservation_id uuid references public.reservations(id) on delete set null;

alter table public.conversations
  add column if not exists direct_pair_key text;

-- V8 only allowed listing/support. Extend the existing constraint safely.
alter table public.conversations
  drop constraint if exists conversations_kind_check;

alter table public.conversations
  add constraint conversations_kind_check
  check (kind in ('listing','support','reservation','direct'));

create unique index if not exists uq_reservation_conversation
  on public.conversations(reservation_id)
  where kind = 'reservation' and reservation_id is not null;

create unique index if not exists uq_direct_pair_key
  on public.conversations(direct_pair_key)
  where kind = 'direct' and direct_pair_key is not null;

create index if not exists idx_conversations_reservation
  on public.conversations(reservation_id)
  where reservation_id is not null;

-- 2) Create/reuse the private conversation for a reservation.
--    The intended participants are the student and Campus Crib admin.
create or replace function public.start_reservation_conversation(p_reservation_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reservation public.reservations%rowtype;
  v_conversation uuid;
  v_admin uuid;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'You must be logged in.'; end if;

  select * into v_reservation
  from public.reservations
  where id = p_reservation_id;

  if not found then raise exception 'Reservation not found.'; end if;

  if not (public.is_admin() or v_uid = v_reservation.student_id) then
    raise exception 'You are not allowed to open this reservation conversation.';
  end if;

  select id into v_admin
  from public.profiles
  where role = 'admin'
  order by created_at asc
  limit 1;

  if v_admin is null then raise exception 'Campus Crib support is not configured yet.'; end if;

  select id into v_conversation
  from public.conversations
  where kind = 'reservation' and reservation_id = p_reservation_id
  order by created_at asc
  limit 1;

  if v_conversation is null then
    insert into public.conversations(kind, property_id, reservation_id, created_by)
    select 'reservation', r.property_id, r.id, v_uid
    from public.reservations r
    where r.id = p_reservation_id
    returning id into v_conversation;
  end if;

  insert into public.conversation_members(conversation_id, user_id)
    values (v_conversation, v_reservation.student_id)
    on conflict do nothing;
  insert into public.conversation_members(conversation_id, user_id)
    values (v_conversation, v_admin)
    on conflict do nothing;

  return v_conversation;
end;
$$;
grant execute on function public.start_reservation_conversation(uuid) to authenticated;

-- 3) Automatically create the reservation conversation as soon as a student
--    submits a reservation request. This means the admin can respond before
--    confirming/rejecting anything.
create or replace function public.ensure_reservation_conversation_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.start_reservation_conversation(new.id);
  insert into public.notifications(user_id, message)
  select p.id, 'New reservation request for ' || coalesce(pr.title, 'a listing') || '. Open Reservations to message the student before deciding.'
  from public.profiles p
  cross join lateral (select title from public.properties where id = new.property_id) pr
  where p.role = 'admin';
  return new;
exception when others then
  -- A reservation must never fail merely because chat/support is unavailable.
  return new;
end;
$$;

drop trigger if exists reservations_create_conversation on public.reservations;
create trigger reservations_create_conversation
after insert on public.reservations
for each row execute function public.ensure_reservation_conversation_after_insert();

-- 4) Admin-only direct conversation creation for contacting any registered
--    student/landlord from the Users or Reservations panels.
create or replace function public.start_direct_conversation(p_target_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_first uuid;
  v_second uuid;
  v_pair_key text;
  v_conversation uuid;
begin
  if v_uid is null or not public.is_admin() then
    raise exception 'Only an admin can start a direct user conversation.';
  end if;
  if not exists (select 1 from public.profiles where id = p_target_user_id) then
    raise exception 'User not found.';
  end if;
  if p_target_user_id = v_uid then raise exception 'You cannot start a conversation with yourself.'; end if;

  if v_uid < p_target_user_id then
    v_first := v_uid; v_second := p_target_user_id;
  else
    v_first := p_target_user_id; v_second := v_uid;
  end if;
  v_pair_key := v_first::text || ':' || v_second::text;

  select id into v_conversation
  from public.conversations
  where kind = 'direct' and direct_pair_key = v_pair_key
  limit 1;

  if v_conversation is null then
    insert into public.conversations(kind, created_by, direct_pair_key)
    values ('direct', v_uid, v_pair_key)
    returning id into v_conversation;
  end if;

  insert into public.conversation_members(conversation_id, user_id)
    values (v_conversation, v_uid) on conflict do nothing;
  insert into public.conversation_members(conversation_id, user_id)
    values (v_conversation, p_target_user_id) on conflict do nothing;

  return v_conversation;
end;
$$;
grant execute on function public.start_direct_conversation(uuid) to authenticated;

-- 5) Admin-only user directory. auth.users.email is intentionally not exposed
--    through normal profile reads. This RPC lets admins see the complete
--    contact information needed to operate Campus Crib.
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
    p.phone::text,
    au.email::text,
    p.created_at,
    p.is_suspended,
    p.suspension_reason::text,
    p.suspended_until,
    lp.contact_email::text,
    lp.contact_whatsapp::text
  from public.profiles p
  join auth.users au on au.id = p.id
  left join public.landlord_profiles lp on lp.id = p.id
  where public.is_admin()
  order by p.created_at desc;
$$;
grant execute on function public.get_admin_user_directory() to authenticated;

-- 6) Admins need a reliable way to open the reservation conversation from a
--    reservation record. The existing conversation RLS already permits admin
--    reads; this function adds the admin as a member so message INSERT policy
--    also works.
create or replace function public.ensure_admin_reservation_chat(p_reservation_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Only an admin can open a reservation conversation.'; end if;
  return public.start_reservation_conversation(p_reservation_id);
end;
$$;
grant execute on function public.ensure_admin_reservation_chat(uuid) to authenticated;

comment on column public.conversations.reservation_id is 'Reservation associated with a private student/Admin conversation.';
comment on function public.get_admin_user_directory() is 'Admin-only directory including auth email and profile phone.';
