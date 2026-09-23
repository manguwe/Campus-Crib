-- =========================================================================
-- Campus Crib — Permanent referral system
-- Run after the existing Campus Crib SQL migrations.
--
-- Referral attribution is intentionally separate from activity_logs:
-- activity_logs remains general analytics, while these tables answer
-- "who brought this visitor here and what did they do?".
-- =========================================================================

create table if not exists public.referral_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  type text not null check (type in ('creator','student_ambassador','student','organization','landlord','caretaker')),
  description text,
  contact text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.referral_visits (
  id uuid primary key default gen_random_uuid(),
  referral_source_id uuid not null references public.referral_sources(id) on delete cascade,
  session_id text not null,
  user_id uuid references auth.users(id) on delete set null,
  landing_page text,
  user_type text check (user_type in ('student','landlord','caretaker','other')),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table if not exists public.referral_events (
  id uuid primary key default gen_random_uuid(),
  referral_visit_id uuid references public.referral_visits(id) on delete cascade,
  referral_source_id uuid not null references public.referral_sources(id) on delete cascade,
  session_id text not null,
  user_id uuid references auth.users(id) on delete set null,
  event_type text not null check (event_type in (
    'visit',
    'feedback_submitted',
    'signup',
    'profile_completed',
    'listing_created',
    'listing_activity'
  )),
  details jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_referral_sources_code on public.referral_sources(code);
create index if not exists idx_referral_visits_source on public.referral_visits(referral_source_id);
create index if not exists idx_referral_visits_session on public.referral_visits(session_id);
create index if not exists idx_referral_visits_user on public.referral_visits(user_id);
create index if not exists idx_referral_events_source on public.referral_events(referral_source_id);
create index if not exists idx_referral_events_user on public.referral_events(user_id);
create index if not exists idx_referral_events_type_created on public.referral_events(event_type, created_at desc);

alter table public.referral_sources enable row level security;
alter table public.referral_visits enable row level security;
alter table public.referral_events enable row level security;

-- Sources are managed by admins. Visitors never need direct table access.
create policy "admins can manage referral sources"
  on public.referral_sources for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Admins can inspect attribution rows; inserts/updates happen through the
-- SECURITY DEFINER functions below so anonymous visitors need no table policy.
create policy "admins can view referral visits"
  on public.referral_visits for select
  to authenticated
  using (public.is_admin());

create policy "admins can view referral events"
  on public.referral_events for select
  to authenticated
  using (public.is_admin());

create or replace function public.capture_referral_visit(
  p_code text,
  p_session_id text,
  p_landing_page text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  source_row referral_sources;
  visit_id uuid;
begin
  if p_code is null or trim(p_code) = '' or p_session_id is null or trim(p_session_id) = '' then
    return jsonb_build_object('captured', false);
  end if;

  select * into source_row
  from referral_sources
  where upper(code) = upper(trim(p_code)) and active = true
  limit 1;

  if source_row.id is null then
    return jsonb_build_object('captured', false);
  end if;

  select id into visit_id
  from referral_visits
  where referral_source_id = source_row.id
    and session_id = p_session_id
  order by created_at desc
  limit 1;

  if visit_id is null then
    insert into referral_visits (referral_source_id, session_id, landing_page)
    values (source_row.id, p_session_id, left(p_landing_page, 500))
    returning id into visit_id;

    insert into referral_events (referral_visit_id, referral_source_id, session_id, event_type, details)
    values (visit_id, source_row.id, p_session_id, 'visit', jsonb_build_object('landing_page', left(p_landing_page, 500)));
  else
    update referral_visits
      set last_seen_at = now(),
          landing_page = coalesce(landing_page, left(p_landing_page, 500))
    where id = visit_id;
  end if;

  return jsonb_build_object(
    'captured', true,
    'sourceId', source_row.id,
    'sourceName', source_row.name,
    'sourceCode', source_row.code,
    'visitId', visit_id
  );
end;
$$;

grant execute on function public.capture_referral_visit(text, text, text) to anon, authenticated;

create or replace function public.claim_referral_for_user(
  p_session_id text,
  p_user_id uuid,
  p_record_signup boolean default false
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  visit_row referral_visits;
begin
  if p_user_id is null or p_user_id <> auth.uid() or p_session_id is null then
    return false;
  end if;

  select * into visit_row
  from referral_visits
  where session_id = p_session_id
  order by last_seen_at desc, created_at desc
  limit 1;

  if visit_row.id is null then
    return false;
  end if;

  update referral_visits
    set user_id = p_user_id, last_seen_at = now()
  where id = visit_row.id;

  if p_record_signup and not exists (
    select 1 from referral_events
    where referral_visit_id = visit_row.id
      and event_type = 'signup'
      and user_id = p_user_id
  ) then
    insert into referral_events (referral_visit_id, referral_source_id, session_id, user_id, event_type)
    values (visit_row.id, visit_row.referral_source_id, p_session_id, p_user_id, 'signup');
  end if;

  return true;
end;
$$;

grant execute on function public.claim_referral_for_user(text, uuid, boolean) to authenticated;

create or replace function public.record_referral_event(
  p_event_type text,
  p_details jsonb default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  session_value text;
  visit_row referral_visits;
  source_id uuid;
  current_user_id uuid;
begin
  if p_event_type not in ('feedback_submitted','profile_completed','listing_created','listing_activity') then
    return false;
  end if;

  current_user_id := auth.uid();
  session_value := nullif(current_setting('request.headers', true)::jsonb ->> 'x-cc-session-id', '');

  if session_value is null then
    return false;
  end if;

  select * into visit_row
  from referral_visits
  where session_id = session_value
  order by last_seen_at desc, created_at desc
  limit 1;

  if visit_row.id is null then
    return false;
  end if;

  source_id := visit_row.referral_source_id;

  insert into referral_events (referral_visit_id, referral_source_id, session_id, user_id, event_type, details)
  values (visit_row.id, source_id, session_value, current_user_id, p_event_type, p_details);

  update referral_visits set last_seen_at = now() where id = visit_row.id;
  return true;
exception when others then
  return false;
end;
$$;

-- The browser cannot set custom PostgREST request headers through supabase-js
-- RPC reliably across all deployments, so the client uses the safer, explicit
-- session/user claim function below for events.
create or replace function public.record_referral_event_for_session(
  p_session_id text,
  p_event_type text,
  p_user_id uuid default null,
  p_details jsonb default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  visit_row referral_visits;
  effective_user uuid;
begin
  if p_event_type not in ('feedback_submitted','profile_completed','listing_created','listing_activity') then
    return false;
  end if;

  effective_user := coalesce(p_user_id, auth.uid());
  if p_user_id is not null and p_user_id <> auth.uid() then
    return false;
  end if;

  select * into visit_row
  from referral_visits
  where session_id = p_session_id
  order by last_seen_at desc, created_at desc
  limit 1;

  if visit_row.id is null then return false; end if;

  insert into referral_events (referral_visit_id, referral_source_id, session_id, user_id, event_type, details)
  values (visit_row.id, visit_row.referral_source_id, p_session_id, effective_user, p_event_type, p_details);

  update referral_visits
    set user_id = coalesce(user_id, effective_user), last_seen_at = now()
  where id = visit_row.id;

  return true;
end;
$$;

grant execute on function public.record_referral_event_for_session(text, text, uuid, jsonb) to anon, authenticated;

create or replace function public.admin_referral_summary()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;

  return jsonb_build_object(
    'totalVisits', (select count(*) from referral_visits),
    'referredUsers', (select count(distinct user_id) from referral_visits where user_id is not null),
    'feedback', (select count(*) from referral_events where event_type = 'feedback_submitted'),
    'signups', (select count(*) from referral_events where event_type = 'signup'),
    'listings', (select count(*) from referral_events where event_type = 'listing_created'),
    'sources', coalesce((
      select jsonb_agg(row_to_json(s) order by s.visits desc, s.name)
      from (
        select rs.id, rs.name, rs.code, rs.type, rs.active,
          count(distinct rv.id) as visits,
          count(distinct rv.user_id) filter (where rv.user_id is not null) as users,
          count(distinct re.id) filter (where re.event_type = 'feedback_submitted') as feedback,
          count(distinct re.id) filter (where re.event_type = 'signup') as signups,
          count(distinct re.id) filter (where re.event_type = 'listing_created') as listings
        from referral_sources rs
        left join referral_visits rv on rv.referral_source_id = rs.id
        left join referral_events re on re.referral_source_id = rs.id
        group by rs.id
      ) s
    ), '[]'::jsonb)
  );
end;
$$;

grant execute on function public.admin_referral_summary() to authenticated;
