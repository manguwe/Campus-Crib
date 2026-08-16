-- =========================================================================
-- Student Boarding House Finder — Feedback table (with testimonial flag)
-- Run this in the Supabase SQL Editor.
-- Lets any visitor (logged in or not) submit feedback, viewable by admins.
-- Admins can flag an entry to display publicly as a testimonial.
-- =========================================================================

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  submitted_by uuid references public.profiles(id), -- nullable, guests can submit too
  name text,        -- optional, for guests not logged in
  email text,       -- optional
  message text not null,
  created_at timestamptz not null default now(),
  is_read boolean not null default false,
  show_as_testimonial boolean not null default false
);

alter table public.feedback enable row level security;

-- Anyone (including anonymous/anon key) can submit feedback.
create policy "Anyone can submit feedback"
  on public.feedback for insert
  with check (true);

-- Only admins can read feedback in general (the inbox view).
create policy "Admins can read feedback"
  on public.feedback for select
  using (
    exists (
      select 1 from public.profiles pr
      where pr.id = auth.uid() and pr.role = 'admin'
    )
  );

-- Public (including guests) can read only entries flagged for display —
-- this is what powers the Home page testimonials section without
-- requiring login.
create policy "Public can read testimonial-flagged feedback"
  on public.feedback for select
  using (show_as_testimonial = true);

-- Only admins can update feedback (mark as read, flag as testimonial).
create policy "Admins can update feedback"
  on public.feedback for update
  using (
    exists (
      select 1 from public.profiles pr
      where pr.id = auth.uid() and pr.role = 'admin'
    )
  );

-- Verify:
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'feedback'
order by ordinal_position;
