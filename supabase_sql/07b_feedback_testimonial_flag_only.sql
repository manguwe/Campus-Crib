-- Add the column only if it's not already there:
alter table public.feedback
  add column if not exists show_as_testimonial boolean not null default false;

-- Drop-then-create the policy so this is safe to run even if it partially
-- exists already:
drop policy if exists "Public can read testimonial-flagged feedback" on public.feedback;

create policy "Public can read testimonial-flagged feedback"
  on public.feedback for select
  using (show_as_testimonial = true);

-- Verify:
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'feedback'
order by ordinal_position;

select policyname, cmd
from pg_policies
where schemaname = 'public' and tablename = 'feedback';
