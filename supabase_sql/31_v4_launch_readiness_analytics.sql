-- Campus Crib V4: launch-readiness + referral funnel analytics.
-- Run after 30_pre_launch_platform_mode.sql.

-- Add a lightweight interest signal to measure genuine pre-launch intent.
alter table public.referral_events drop constraint if exists referral_events_event_type_check;
alter table public.referral_events add constraint referral_events_event_type_check
  check (event_type in (
    'visit',
    'interest_signal',
    'feedback_submitted',
    'signup',
    'profile_completed',
    'listing_created',
    'listing_activity'
  ));

create index if not exists idx_referral_events_interest
  on public.referral_events(event_type, created_at desc)
  where event_type = 'interest_signal';

create or replace function public.record_referral_interest_for_session(
  p_session_id text,
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
  effective_user := coalesce(p_user_id, auth.uid());
  if p_user_id is not null and p_user_id <> auth.uid() then return false; end if;
  if p_session_id is null or trim(p_session_id) = '' then return false; end if;

  select * into visit_row
  from referral_visits
  where session_id = p_session_id
  order by last_seen_at desc, created_at desc
  limit 1;

  if visit_row.id is null then return false; end if;

  if exists (
    select 1 from referral_events
    where referral_visit_id = visit_row.id
      and event_type = 'interest_signal'
  ) then
    return true;
  end if;

  insert into referral_events (
    referral_visit_id, referral_source_id, session_id, user_id, event_type, details
  ) values (
    visit_row.id, visit_row.referral_source_id, p_session_id, effective_user,
    'interest_signal', p_details
  );

  update referral_visits
    set user_id = coalesce(user_id, effective_user), last_seen_at = now()
  where id = visit_row.id;

  return true;
exception when others then
  return false;
end;
$$;

grant execute on function public.record_referral_interest_for_session(text, uuid, jsonb)
to anon, authenticated;

-- One admin RPC powers the launch-readiness dashboard without exposing raw
-- referral rows to normal visitors.
create or replace function public.admin_launch_readiness_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;

  select jsonb_build_object(
    'mode', public.get_platform_mode(),
    'feedback', jsonb_build_object(
      'total', count(*) filter (where f.source = 'pre_launch_research'),
      'withRating', count(*) filter (where f.source = 'pre_launch_research' and f.rating is not null),
      'averageRating', coalesce(round((avg(f.rating) filter (where f.source = 'pre_launch_research'))::numeric, 2), 0),
      'students', count(*) filter (where f.source = 'pre_launch_research' and f.user_type = 'student'),
      'landlords', count(*) filter (where f.source = 'pre_launch_research' and f.user_type = 'landlord'),
      'caretakers', count(*) filter (where f.source = 'pre_launch_research' and f.user_type = 'caretaker'),
      'other', count(*) filter (where f.source = 'pre_launch_research' and f.user_type = 'other')
    ),
    'referrals', jsonb_build_object(
      'visits', (select count(*) from referral_visits),
      'users', (select count(distinct user_id) from referral_visits where user_id is not null),
      'interest', (select count(*) from referral_events where event_type = 'interest_signal'),
      'signups', (select count(*) from referral_events where event_type = 'signup'),
      'profiles', (select count(*) from referral_events where event_type = 'profile_completed'),
      'listings', (select count(*) from referral_events where event_type = 'listing_created'),
      'feedback', (select count(*) from referral_events where event_type = 'feedback_submitted')
    ),
    'invites', (select count(*) from referral_invites),
    'activeSources', (select count(*) from referral_sources where active = true)
  ) into result
  from public.feedback f;

  return result;
end;
$$;

grant execute on function public.admin_launch_readiness_summary() to authenticated;

-- Per-source funnel for the admin referral dashboard.
create or replace function public.admin_referral_funnel()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;

  return coalesce((
    select jsonb_agg(row_to_json(s) order by s.visits desc, s.name)
    from (
      select
        rs.id,
        rs.name,
        rs.code,
        rs.type,
        rs.active,
        count(distinct rv.id) as visits,
        count(distinct rv.user_id) filter (where rv.user_id is not null) as users,
        count(distinct re.id) filter (where re.event_type = 'interest_signal') as interest,
        count(distinct re.id) filter (where re.event_type = 'signup') as signups,
        count(distinct re.id) filter (where re.event_type = 'profile_completed') as profiles,
        count(distinct re.id) filter (where re.event_type = 'feedback_submitted') as feedback,
        count(distinct re.id) filter (where re.event_type = 'listing_created') as listings,
        count(distinct ri.id) as invites
      from referral_sources rs
      left join referral_visits rv on rv.referral_source_id = rs.id
      left join referral_events re on re.referral_source_id = rs.id
      left join referral_invites ri on ri.referral_source_id = rs.id
      group by rs.id, rs.name, rs.code, rs.type, rs.active
    ) s
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.admin_referral_funnel() to authenticated;
