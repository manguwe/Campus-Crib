-- Campus Crib V5: robust public feedback submission policy.
-- Fixes: "new row violates row-level security policy for table feedback"
-- Run after 31_v4_launch_readiness_analytics.sql.

alter table public.feedback enable row level security;

drop policy if exists "Anyone can submit feedback" on public.feedback;
create policy "Anyone can submit feedback"
  on public.feedback
  for insert
  to anon, authenticated
  with check (true);

-- Keep feedback private after submission except for admins and approved testimonials.
drop policy if exists "Admins can read feedback" on public.feedback;
create policy "Admins can read feedback"
  on public.feedback
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles pr
      where pr.id = auth.uid()
        and pr.role = 'admin'
    )
    or show_as_testimonial = true
  );

drop policy if exists "Public can read testimonial-flagged feedback" on public.feedback;
create policy "Public can read testimonial-flagged feedback"
  on public.feedback
  for select
  to anon, authenticated
  using (show_as_testimonial = true);

drop policy if exists "Admins can update feedback" on public.feedback;
create policy "Admins can update feedback"
  on public.feedback
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.profiles pr
      where pr.id = auth.uid()
        and pr.role = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.profiles pr
      where pr.id = auth.uid()
        and pr.role = 'admin'
    )
  );

grant insert on public.feedback to anon, authenticated;
grant select on public.feedback to anon, authenticated;
grant update on public.feedback to authenticated;

-- Verify policies after running this migration:
select policyname, cmd, roles
from pg_policies
where schemaname = 'public' and tablename = 'feedback'
order by policyname;
