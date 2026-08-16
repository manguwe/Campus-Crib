-- =========================================================================
-- Student Boarding House Finder — Activity logs
-- Run this in the Supabase SQL Editor.
--
-- Tracks what users do on the platform (page views, key actions, and
-- client-side errors) so admins can see a timeline per user, and so that
-- if the app breaks, you can see exactly which page/action it happened on.
-- =========================================================================

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id), -- nullable: guests get logged too
  role text, -- snapshot of role at the time (student/landlord/admin/null for guest)
  event_type text not null, -- e.g. 'page_view', 'login', 'signup', 'error',
                             -- 'listing_created', 'favourite_added', 'review_submitted'
  path text, -- the route/page this happened on, e.g. '/browse'
  details jsonb, -- freeform extra info: error message/stack, search filters used, etc.
  created_at timestamptz not null default now()
);

alter table public.activity_logs enable row level security;

-- Anyone (including anonymous visitors, via the anon key) can write a log
-- entry — that's the whole point, we want guests' activity too, not just
-- logged-in users.
create policy "Anyone can insert activity logs"
  on public.activity_logs for insert
  with check (true);

-- Only admins can read logs — this is sensitive behavioral data, not
-- something every user should see about every other user.
create policy "Admins can read all activity logs"
  on public.activity_logs for select
  using (
    exists (
      select 1 from public.profiles pr
      where pr.id = auth.uid() and pr.role = 'admin'
    )
  );

-- Helpful index for the common query: "show me this one user's timeline"
create index if not exists idx_activity_logs_user_id_created_at
  on public.activity_logs (user_id, created_at desc);

-- Verify:
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'activity_logs'
order by ordinal_position;
