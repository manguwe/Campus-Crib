-- 44_agents_step2.sql
-- Agents programme, step 2:
--   * owner details (name, phone, consent) per agent listing, visible only to the agent and admins
--   * an agent listing cannot be approved until owner details and consent are recorded
--   * a second switch to hide agent listings from the public (agents_listings_visible), and agent listings of a
--     suspended agent are hidden too
--   * admin_agent_stats(): per-agent numbers for the admin Agents tab
-- Run after 43_agents_program.sql. Safe to run more than once.

-- 1. Helpers -------------------------------------------------------------------------
create or replace function public.is_agent_user(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.agent_profiles where id = p_user);
$$;
grant execute on function public.is_agent_user(uuid) to anon, authenticated;

create or replace function public.agent_listings_visible()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select value from public.platform_settings where key = 'agents_listings_visible'), 'on') = 'on';
$$;
grant execute on function public.agent_listings_visible() to anon, authenticated;

create or replace function public.set_agent_listings_visible(p_visible boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only an admin can change agent listing visibility';
  end if;

  insert into public.platform_settings(key, value, updated_at, updated_by)
  values ('agents_listings_visible', case when p_visible then 'on' else 'off' end, now(), auth.uid())
  on conflict (key) do update
    set value = excluded.value, updated_at = now(), updated_by = auth.uid();

  return p_visible;
end;
$$;
revoke all on function public.set_agent_listings_visible(boolean) from public, anon;
grant execute on function public.set_agent_listings_visible(boolean) to authenticated;

-- true when this landlord is an agent whose listings should currently be hidden from the public
create or replace function public.agent_listing_is_hidden(p_landlord uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_agent_user(p_landlord)
     and (
       not public.agent_listings_visible()
       or coalesce((select is_suspended from public.profiles where id = p_landlord), false)
     );
$$;
grant execute on function public.agent_listing_is_hidden(uuid) to anon, authenticated;

-- 2. Hide agent listings when switched off or when the agent is suspended ------------------
-- A RESTRICTIVE policy is combined (AND) with the existing rules, so the current visibility rules stay as they are.
drop policy if exists "agent listings can be hidden" on public.properties;
create policy "agent listings can be hidden"
  on public.properties
  as restrictive
  for select
  to anon, authenticated
  using (
    not public.agent_listing_is_hidden(landlord_id)
    or auth.uid() = landlord_id
    or public.is_admin()
  );

-- 3. Owner details (private) -------------------------------------------------------------
create table if not exists public.property_owner_details (
  property_id uuid primary key references public.properties (id) on delete cascade,
  owner_name text,
  owner_phone text,
  owner_consent boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.property_owner_details enable row level security;

drop policy if exists "owner details readable by the agent and admins" on public.property_owner_details;
create policy "owner details readable by the agent and admins"
  on public.property_owner_details for select to authenticated
  using (
    public.is_admin()
    or exists (select 1 from public.properties p where p.id = property_id and p.landlord_id = auth.uid())
  );

drop policy if exists "agents add owner details for their listings" on public.property_owner_details;
create policy "agents add owner details for their listings"
  on public.property_owner_details for insert to authenticated
  with check (
    public.is_admin()
    or (
      public.is_agent_user(auth.uid())
      and public.agents_program_enabled()
      and exists (select 1 from public.properties p where p.id = property_id and p.landlord_id = auth.uid())
    )
  );

drop policy if exists "agents update owner details for their listings" on public.property_owner_details;
create policy "agents update owner details for their listings"
  on public.property_owner_details for update to authenticated
  using (
    public.is_admin()
    or (
      public.is_agent_user(auth.uid())
      and public.agents_program_enabled()
      and exists (select 1 from public.properties p where p.id = property_id and p.landlord_id = auth.uid())
    )
  )
  with check (
    public.is_admin()
    or (
      public.is_agent_user(auth.uid())
      and public.agents_program_enabled()
      and exists (select 1 from public.properties p where p.id = property_id and p.landlord_id = auth.uid())
    )
  );

drop policy if exists "admins delete owner details" on public.property_owner_details;
create policy "admins delete owner details"
  on public.property_owner_details for delete to authenticated
  using (public.is_admin());

revoke all on public.property_owner_details from anon;
revoke all on public.property_owner_details from authenticated;
grant select, insert, update, delete on public.property_owner_details to authenticated;

-- 4. An agent listing cannot be approved without owner details and consent -----------------
create or replace function public.require_owner_details_for_agent_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'approved'
     and old.status is distinct from 'approved'
     and public.is_agent_user(new.landlord_id)
     and not exists (
       select 1 from public.property_owner_details d
       where d.property_id = new.id
         and d.owner_consent
         and nullif(trim(coalesce(d.owner_name, '')), '') is not null
         and nullif(trim(coalesce(d.owner_phone, '')), '') is not null
     ) then
    raise exception 'Owner details and consent are required before an agent listing can be approved.';
  end if;

  return new;
end;
$$;

drop trigger if exists properties_require_owner_details on public.properties;
create trigger properties_require_owner_details
  before update on public.properties
  for each row execute function public.require_owner_details_for_agent_approval();

-- 5. Numbers for the admin Agents tab ---------------------------------------------------
create or replace function public.admin_agent_stats()
returns table (
  agent_id uuid,
  listings_total bigint,
  listings_live bigint,
  listings_pending bigint,
  listings_rejected bigint,
  enquiries bigint,
  reservations_total bigint,
  reservations_confirmed bigint,
  last_listing_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only an admin can view agent statistics';
  end if;

  return query
  select
    a.id,
    count(p.id),
    count(p.id) filter (where p.status = 'approved'),
    count(p.id) filter (where p.status = 'pending'),
    count(p.id) filter (where p.status = 'rejected'),
    (select count(*) from public.conversations c
       where c.property_id in (select id from public.properties where landlord_id = a.id)),
    (select count(*) from public.reservations r
       where r.property_id in (select id from public.properties where landlord_id = a.id)),
    (select count(*) from public.reservations r
       where r.status = 'confirmed'
         and r.property_id in (select id from public.properties where landlord_id = a.id)),
    max(p.created_at)
  from public.agent_profiles a
  left join public.properties p on p.landlord_id = a.id
  group by a.id;
end;
$$;
revoke all on function public.admin_agent_stats() from public, anon;
grant execute on function public.admin_agent_stats() to authenticated;
