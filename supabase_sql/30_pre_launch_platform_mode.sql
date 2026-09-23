-- Campus Crib V3: permanent platform mode + structured pre-launch research feedback.
-- Run after 29_referral_invitations.sql.

create table if not exists public.platform_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

insert into public.platform_settings (key, value)
values ('platform_mode', 'pre_launch')
on conflict (key) do nothing;

alter table public.platform_settings enable row level security;

drop policy if exists "Public can read platform mode" on public.platform_settings;
create policy "Public can read platform mode"
  on public.platform_settings for select
  using (key = 'platform_mode');

drop policy if exists "Admins can manage platform settings" on public.platform_settings;
create policy "Admins can manage platform settings"
  on public.platform_settings for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create or replace function public.get_platform_mode()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select value from public.platform_settings where key = 'platform_mode'), 'pre_launch');
$$;

grant execute on function public.get_platform_mode() to anon, authenticated;

create or replace function public.set_platform_mode(p_mode text)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin') then
    raise exception 'Only administrators can change platform mode';
  end if;
  if p_mode not in ('pre_launch', 'public_launch', 'maintenance') then
    raise exception 'Invalid platform mode';
  end if;
  insert into public.platform_settings(key, value, updated_at, updated_by)
  values ('platform_mode', p_mode, now(), auth.uid())
  on conflict (key) do update set value = excluded.value, updated_at = now(), updated_by = auth.uid();
  return p_mode;
end;
$$;

grant execute on function public.set_platform_mode(text) to authenticated;

alter table public.feedback add column if not exists user_type text;
alter table public.feedback add column if not exists rating smallint;
alter table public.feedback add column if not exists suggestion text;
alter table public.feedback add column if not exists feature_requests text;
alter table public.feedback add column if not exists source text;

alter table public.feedback drop constraint if exists feedback_user_type_check;
alter table public.feedback add constraint feedback_user_type_check
  check (user_type is null or user_type in ('student', 'landlord', 'caretaker', 'other'));

alter table public.feedback drop constraint if exists feedback_rating_check;
alter table public.feedback add constraint feedback_rating_check
  check (rating is null or rating between 1 and 5);

create index if not exists feedback_source_idx on public.feedback(source);
create index if not exists feedback_user_type_idx on public.feedback(user_type);
create index if not exists feedback_rating_idx on public.feedback(rating);

-- Admin-only aggregate view for research analytics.
create or replace function public.get_prelaunch_feedback_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin') then
    raise exception 'Only administrators can view pre-launch feedback analytics';
  end if;
  select jsonb_build_object(
    'total', count(*),
    'with_rating', count(*) filter (where rating is not null),
    'average_rating', round(avg(rating)::numeric, 2),
    'students', count(*) filter (where user_type = 'student'),
    'landlords', count(*) filter (where user_type = 'landlord'),
    'caretakers', count(*) filter (where user_type = 'caretaker'),
    'other', count(*) filter (where user_type = 'other')
  ) into result
  from public.feedback
  where source = 'pre_launch_research';
  return result;
end;
$$;

grant execute on function public.get_prelaunch_feedback_summary() to authenticated;
