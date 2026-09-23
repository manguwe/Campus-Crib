-- Campus Crib Referral System V2 — invitations
-- Run after 28_referral_system.sql

alter table public.referral_sources
  add column if not exists owner_user_id uuid references auth.users(id) on delete set null;

create unique index if not exists idx_referral_sources_owner_user
  on public.referral_sources(owner_user_id)
  where owner_user_id is not null;

create or replace function public.ensure_my_referral_source()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  p profiles;
  existing referral_sources;
  base_code text;
  final_code text;
  source_type text;
  label text;
  suffix text;
begin
  if uid is null then raise exception 'Authentication required'; end if;

  select * into p from profiles where id = uid;
  if p.id is null then raise exception 'Profile not found'; end if;

  select * into existing from referral_sources where owner_user_id = uid limit 1;
  if existing.id is not null then
    return jsonb_build_object('id', existing.id, 'name', existing.name, 'code', existing.code, 'type', existing.type);
  end if;

  source_type := case p.role
    when 'landlord' then 'landlord'
    when 'student' then 'student'
    else 'student'
  end;

  label := coalesce(nullif(trim(p.name), ''), 'Campus Crib User');
  base_code := upper(regexp_replace(coalesce(nullif(trim(p.name), ''), 'USER'), '[^A-Za-z0-9]+', '', 'g'));
  base_code := left(base_code, 12);
  suffix := upper(substr(replace(uid::text, '-', ''), 1, 6));
  final_code := left(case when base_code = '' then 'CC' else base_code end || suffix, 24);

  insert into referral_sources (name, code, type, description, owner_user_id, active)
  values (label, final_code, source_type, 'Personal referral link', uid, true)
  returning * into existing;

  return jsonb_build_object('id', existing.id, 'name', existing.name, 'code', existing.code, 'type', existing.type);
end;
$$;

grant execute on function public.ensure_my_referral_source() to authenticated;

create table if not exists public.referral_invites (
  id uuid primary key default gen_random_uuid(),
  referral_source_id uuid not null references public.referral_sources(id) on delete cascade,
  inviter_user_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null check (target_type in ('student','landlord','caretaker','friend')),
  channel text,
  details jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_referral_invites_source on public.referral_invites(referral_source_id);
create index if not exists idx_referral_invites_inviter on public.referral_invites(inviter_user_id);

alter table public.referral_invites enable row level security;

create policy "users can view their own referral invites"
  on public.referral_invites for select
  to authenticated
  using (inviter_user_id = auth.uid() or public.is_admin());

create or replace function public.record_referral_invite(
  p_target_type text,
  p_channel text default null,
  p_details jsonb default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  source_row referral_sources;
begin
  if auth.uid() is null then return false; end if;
  if p_target_type not in ('student','landlord','caretaker','friend') then return false; end if;

  select * into source_row from referral_sources where owner_user_id = auth.uid() and active = true limit 1;
  if source_row.id is null then return false; end if;

  insert into referral_invites (referral_source_id, inviter_user_id, target_type, channel, details)
  values (source_row.id, auth.uid(), p_target_type, left(p_channel, 50), p_details);
  return true;
end;
$$;

grant execute on function public.record_referral_invite(text, text, jsonb) to authenticated;
