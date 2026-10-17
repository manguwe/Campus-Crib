-- 43_agents_program.sql
-- Agents program with a pause switch.
--   * Agents sign up through the normal landlord pipeline (ID verification, listings, media, chat).
--   * An agent is simply a landlord account that also has a row in public.agent_profiles.
--   * The programme is OFF (paused) until an admin switches it on. While paused, agents can still log in and
--     see their listings, but the database refuses to let them add or edit listings or listing media.
-- Safe to run more than once. Run in the Supabase SQL Editor.

-- 1. Agent details ---------------------------------------------------------
create table if not exists public.agent_profiles (
  id uuid primary key references public.profiles (id) on delete cascade,
  agency_name text,
  service_area text,
  declaration_accepted boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.agent_profiles enable row level security;

drop policy if exists "agents can read their own agent profile" on public.agent_profiles;
create policy "agents can read their own agent profile"
  on public.agent_profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists "agents can update their own agent profile" on public.agent_profiles;
create policy "agents can update their own agent profile"
  on public.agent_profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Only admins can turn a landlord into an agent (or back) by hand. Normal signups create the row through the
-- signup trigger below, which runs with elevated rights.
drop policy if exists "admins can add agent profiles" on public.agent_profiles;
create policy "admins can add agent profiles"
  on public.agent_profiles for insert to authenticated
  with check (public.is_admin());

drop policy if exists "admins can remove agent profiles" on public.agent_profiles;
create policy "admins can remove agent profiles"
  on public.agent_profiles for delete to authenticated
  using (public.is_admin());

revoke all on public.agent_profiles from anon;
revoke all on public.agent_profiles from authenticated;
grant select, insert, delete on public.agent_profiles to authenticated;
grant update (agency_name, service_area) on public.agent_profiles to authenticated;

-- 2. The pause switch (stored in platform_settings like the platform mode) -
create or replace function public.agents_program_enabled()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select value from public.platform_settings where key = 'agents_program'), 'off') = 'on';
$$;
grant execute on function public.agents_program_enabled() to anon, authenticated;

create or replace function public.set_agents_program(p_enabled boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only an admin can change the agent program';
  end if;

  insert into public.platform_settings(key, value, updated_at, updated_by)
  values ('agents_program', case when p_enabled then 'on' else 'off' end, now(), auth.uid())
  on conflict (key) do update
    set value = excluded.value, updated_at = now(), updated_by = auth.uid();

  return p_enabled;
end;
$$;
revoke all on function public.set_agents_program(boolean) from public, anon;
grant execute on function public.set_agents_program(boolean) to authenticated;

-- 3. While paused, agents cannot add or edit their own listings or listing media -----
create or replace function public.block_paused_agent_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
begin
  if tg_table_name = 'property_media' then
    select landlord_id into v_owner from public.properties where id = new.property_id;
  else
    v_owner := new.landlord_id;
  end if;

  if auth.uid() is not null
     and auth.uid() = v_owner
     and not public.is_admin()
     and exists (select 1 from public.agent_profiles a where a.id = v_owner)
     and not public.agents_program_enabled() then
    raise exception 'The agent program is currently paused. Agents cannot add or edit listings right now.';
  end if;

  return new;
end;
$$;

drop trigger if exists properties_block_paused_agents on public.properties;
create trigger properties_block_paused_agents
  before insert or update on public.properties
  for each row execute function public.block_paused_agent_changes();

drop trigger if exists property_media_block_paused_agents on public.property_media;
create trigger property_media_block_paused_agents
  before insert on public.property_media
  for each row execute function public.block_paused_agent_changes();

-- 4. Create the agent row when an agent's profile is created --------------------------
-- A separate small trigger on profiles, so the existing signup function (handle_new_user) is left untouched.
-- It reads the "account_type" the registration form saved in the person's signup details.
create or replace function public.create_agent_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_meta jsonb;
begin
  if new.role = 'landlord' then
    select raw_user_meta_data into v_meta from auth.users where id = new.id;

    if coalesce(v_meta ->> 'account_type', '') = 'agent' then
      insert into public.agent_profiles (id, agency_name, service_area, declaration_accepted)
      values (
        new.id,
        nullif(trim(v_meta ->> 'agency_name'), ''),
        nullif(trim(v_meta ->> 'service_area'), ''),
        coalesce(v_meta ->> 'agent_declaration', '') = 'true'
      )
      on conflict (id) do nothing;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_create_agent_profile on public.profiles;
create trigger profiles_create_agent_profile
  after insert on public.profiles
  for each row execute function public.create_agent_profile_for_new_user();
