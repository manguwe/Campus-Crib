-- =========================================================================
-- Campus Crib — Anonymous visitor analytics + landlord listing stats
-- Run this in the Supabase SQL Editor.
--
-- Part 1: extends activity_logs (rather than a new table - it already
-- accepts anonymous inserts with a nullable user_id, so this fits
-- without awkward nullable columns anywhere new) with session_id,
-- country, and duration_seconds, so the same 'page_view' event type
-- already logged today (see src/lib/activityLog.js / App.jsx) can carry
-- anonymous-visitor and time-on-page data too.
--
-- No RLS change is needed for INSERT - 08_activity_logs_table.sql
-- already has `with check (true)` with no `to authenticated`
-- restriction, so the anon role can already insert. SELECT stays
-- admin-only, unchanged.
--
-- Part 2: two SECURITY DEFINER aggregate functions so the Admin Traffic
-- tab and the Landlord dashboard's per-listing stats can each get exact,
-- server-side aggregated numbers without needing any new broad SELECT
-- policy on activity_logs (which would otherwise leak visitor-level
-- rows to non-admins). Each function does its own internal
-- admin/landlord-ownership check, so granting EXECUTE to `authenticated`
-- is safe.
-- =========================================================================

alter table public.activity_logs
  add column if not exists session_id text,
  add column if not exists country text,
  add column if not exists duration_seconds integer;

create index if not exists idx_activity_logs_session_id on public.activity_logs (session_id);
create index if not exists idx_activity_logs_event_type_created_at on public.activity_logs (event_type, created_at desc);
create index if not exists idx_activity_logs_path on public.activity_logs (path);

-- ---------------------------------------------------------------------
-- admin_traffic_summary() - one round trip for the whole admin Traffic
-- tab: unique visitors / page views (today, week, all-time), top 5
-- pages, average time-on-site per session, top countries, and the
-- logged-in-vs-guest split. Raises an exception for a non-admin caller
-- rather than silently returning nothing.
-- ---------------------------------------------------------------------
create or replace function public.admin_traffic_summary()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'Admins only';
  end if;

  select jsonb_build_object(
    'uniqueVisitors', jsonb_build_object(
      'today', (
        select count(distinct session_id) from activity_logs
        where event_type = 'page_view' and session_id is not null
          and created_at >= date_trunc('day', now())
      ),
      'week', (
        select count(distinct session_id) from activity_logs
        where event_type = 'page_view' and session_id is not null
          and created_at >= now() - interval '7 days'
      ),
      'allTime', (
        select count(distinct session_id) from activity_logs
        where event_type = 'page_view' and session_id is not null
      )
    ),
    'pageViews', jsonb_build_object(
      'today', (
        select count(*) from activity_logs
        where event_type = 'page_view' and created_at >= date_trunc('day', now())
      ),
      'week', (
        select count(*) from activity_logs
        where event_type = 'page_view' and created_at >= now() - interval '7 days'
      ),
      'allTime', (select count(*) from activity_logs where event_type = 'page_view')
    ),
    'topPages', (
      select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) from (
        select path, count(*) as views
        from activity_logs
        where event_type = 'page_view' and path is not null
        group by path
        order by views desc
        limit 5
      ) t
    ),
    'avgTimeOnSiteSeconds', (
      select coalesce(round(avg(session_total)), 0) from (
        select session_id, sum(duration_seconds) as session_total
        from activity_logs
        where event_type = 'page_view' and session_id is not null and duration_seconds is not null
        group by session_id
      ) s
    ),
    'countries', (
      select coalesce(jsonb_agg(row_to_json(c)), '[]'::jsonb) from (
        select country, count(distinct session_id) as visitors
        from activity_logs
        where event_type = 'page_view' and country is not null
        group by country
        order by visitors desc
        limit 10
      ) c
    ),
    'loggedInVsGuest', (
      select jsonb_build_object(
        'loggedIn', count(*) filter (where has_user),
        'guest', count(*) filter (where not has_user)
      )
      from (
        select session_id, bool_or(user_id is not null) as has_user
        from activity_logs
        where event_type = 'page_view' and session_id is not null
        group by session_id
      ) v
    )
  ) into result;

  return result;
end;
$$;

grant execute on function public.admin_traffic_summary() to authenticated;

-- ---------------------------------------------------------------------
-- landlord_property_stats() - self-scoped to `p.landlord_id = auth.uid()`,
-- so it only ever returns the calling landlord's own listings, and only
-- aggregate counts (no visitor-level rows, no other students'
-- identities) - safe to grant broadly. Each metric is an independent
-- scalar subquery rather than a join, to avoid join fan-out between
-- activity_logs and favourites inflating the counts.
-- ---------------------------------------------------------------------
create or replace function public.landlord_property_stats()
returns table (
  property_id uuid,
  total_views bigint,
  views_last_7_days bigint,
  favourites_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id as property_id,
    (
      select count(*) from activity_logs al
      where al.event_type = 'page_view' and al.path = '/properties/' || p.id::text
    ) as total_views,
    (
      select count(*) from activity_logs al
      where al.event_type = 'page_view' and al.path = '/properties/' || p.id::text
        and al.created_at >= now() - interval '7 days'
    ) as views_last_7_days,
    (
      select count(*) from favourites f where f.property_id = p.id
    ) as favourites_count
  from properties p
  where p.landlord_id = auth.uid();
$$;

grant execute on function public.landlord_property_stats() to authenticated;

-- Verify:
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'activity_logs'
order by ordinal_position;
