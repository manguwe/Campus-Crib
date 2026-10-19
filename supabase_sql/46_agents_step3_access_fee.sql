-- 46_agents_step3_access_fee.sql
-- Agents programme, step 3: an editable access fee paid outside the app, proof of payment, access control,
-- and an activity log for every agent.
--
-- * The fee amount, currency, payment instructions and access length are edited by admins (platform_settings).
--   The fee starts at 0 = nobody has to pay, so nothing changes until an admin sets an amount.
-- * An agent pays outside the app, uploads proof, and gets access either as soon as the proof is submitted
--   (default, "provisional") or only after an admin confirms it (switchable by the admin).
-- * The database refuses new or edited listings from an agent who has no active access.
-- * agent_events records what each agent does, written by the database itself.
-- Run after 43, 44 and 45. Safe to run more than once.

-- 1. Per-agent overrides ---------------------------------------------------------------------
alter table public.agent_profiles
  add column if not exists access_waived boolean not null default false,
  add column if not exists access_revoked boolean not null default false;

-- 2. Fee settings -----------------------------------------------------------------------------
create or replace function public.get_agent_fee_settings()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'amount', coalesce((select case when value ~ '^[0-9]+(\.[0-9]+)?$' then value::numeric end
                        from public.platform_settings where key = 'agent_fee_amount'), 0),
    'currency', coalesce((select nullif(value, '') from public.platform_settings where key = 'agent_fee_currency'), 'ZMW'),
    'instructions', coalesce((select value from public.platform_settings where key = 'agent_fee_instructions'), ''),
    'access_days', coalesce((select case when value ~ '^[0-9]+$' then value::integer end
                             from public.platform_settings where key = 'agent_access_days'), 0),
    'access_on_submit', coalesce((select value from public.platform_settings where key = 'agent_access_on_submit'), 'on') = 'on'
  );
$$;
revoke all on function public.get_agent_fee_settings() from public, anon;
grant execute on function public.get_agent_fee_settings() to authenticated;

create or replace function public.set_agent_fee_settings(
  p_amount numeric,
  p_currency text,
  p_instructions text,
  p_access_days integer,
  p_access_on_submit boolean
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only an admin can change the agent fee';
  end if;
  if p_amount is null or p_amount < 0 then
    raise exception 'The fee cannot be negative.';
  end if;
  if p_access_days is null or p_access_days < 0 then
    raise exception 'Access days cannot be negative.';
  end if;

  insert into public.platform_settings (key, value, updated_at, updated_by)
  values
    ('agent_fee_amount', p_amount::text, now(), auth.uid()),
    ('agent_fee_currency', upper(coalesce(nullif(trim(p_currency), ''), 'ZMW')), now(), auth.uid()),
    ('agent_fee_instructions', coalesce(p_instructions, ''), now(), auth.uid()),
    ('agent_access_days', p_access_days::text, now(), auth.uid()),
    ('agent_access_on_submit', case when p_access_on_submit then 'on' else 'off' end, now(), auth.uid())
  on conflict (key) do update
    set value = excluded.value, updated_at = now(), updated_by = auth.uid();

  return true;
end;
$$;
revoke all on function public.set_agent_fee_settings(numeric, text, text, integer, boolean) from public, anon;
grant execute on function public.set_agent_fee_settings(numeric, text, text, integer, boolean) to authenticated;

-- 3. Payments with proof -------------------------------------------------------------------------
create table if not exists public.agent_payments (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.profiles (id) on delete cascade,
  amount numeric(12, 2) not null,
  currency text not null default 'ZMW',
  proof_path text not null,
  payer_note text,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'rejected')),
  admin_note text,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  access_from timestamptz,
  access_until timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists agent_payments_one_pending_idx
  on public.agent_payments (agent_id) where status = 'pending';
create index if not exists agent_payments_agent_idx on public.agent_payments (agent_id, created_at desc);

alter table public.agent_payments enable row level security;

drop policy if exists "agents read their own payments and admins read all" on public.agent_payments;
create policy "agents read their own payments and admins read all"
  on public.agent_payments for select to authenticated
  using (agent_id = auth.uid() or public.is_admin());

drop policy if exists "agents submit their own payment proof" on public.agent_payments;
create policy "agents submit their own payment proof"
  on public.agent_payments for insert to authenticated
  with check (agent_id = auth.uid() and status = 'pending');

revoke all on public.agent_payments from anon, authenticated;
grant select on public.agent_payments to authenticated;
grant insert (agent_id, amount, currency, proof_path, payer_note) on public.agent_payments to authenticated;

-- 4. Access state ----------------------------------------------------------------------------------
-- not_agent | revoked | not_required | waived | active | provisional | awaiting_verification | expired | rejected | payment_needed
create or replace function public.agent_access_state(p_agent uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_amount numeric := coalesce((public.get_agent_fee_settings() ->> 'amount')::numeric, 0);
  v_on_submit boolean := coalesce((public.get_agent_fee_settings() ->> 'access_on_submit')::boolean, true);
  a record;
begin
  select access_waived, access_revoked into a from public.agent_profiles where id = p_agent;
  if not found then
    return 'not_agent';
  end if;
  if a.access_revoked then
    return 'revoked';
  end if;
  if v_amount <= 0 then
    return 'not_required';
  end if;
  if a.access_waived then
    return 'waived';
  end if;
  if exists (select 1 from public.agent_payments
             where agent_id = p_agent and status = 'confirmed' and (access_until is null or access_until > now())) then
    return 'active';
  end if;
  if exists (select 1 from public.agent_payments where agent_id = p_agent and status = 'pending') then
    return case when v_on_submit then 'provisional' else 'awaiting_verification' end;
  end if;
  if exists (select 1 from public.agent_payments where agent_id = p_agent and status = 'confirmed') then
    return 'expired';
  end if;
  if exists (select 1 from public.agent_payments where agent_id = p_agent and status = 'rejected') then
    return 'rejected';
  end if;
  return 'payment_needed';
end;
$$;
revoke all on function public.agent_access_state(uuid) from public, anon;
grant execute on function public.agent_access_state(uuid) to authenticated;

create or replace function public.agent_has_access(p_agent uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.agent_access_state(p_agent) in ('active', 'waived', 'not_required', 'provisional');
$$;
revoke all on function public.agent_has_access(uuid) from public, anon;
grant execute on function public.agent_has_access(uuid) to authenticated;

-- What the signed-in agent sees about their own access
create or replace function public.my_agent_access()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v uuid := auth.uid();
  st text;
begin
  if v is null or not public.is_agent_user(v) then
    return null;
  end if;
  st := public.agent_access_state(v);
  return public.get_agent_fee_settings() || jsonb_build_object(
    'state', st,
    'has_access', st in ('active', 'waived', 'not_required', 'provisional'),
    'access_until', (select max(access_until) from public.agent_payments where agent_id = v and status = 'confirmed'),
    'last_rejection', (select admin_note from public.agent_payments
                       where agent_id = v and status = 'rejected'
                       order by reviewed_at desc nulls last limit 1)
  );
end;
$$;
revoke all on function public.my_agent_access() from public, anon;
grant execute on function public.my_agent_access() to authenticated;

-- 5. Activity log -----------------------------------------------------------------------------------
create table if not exists public.agent_events (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.profiles (id) on delete cascade,
  event text not null,
  detail text,
  ref_id uuid,
  actor_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists agent_events_agent_idx on public.agent_events (agent_id, created_at desc);

alter table public.agent_events enable row level security;

drop policy if exists "admins read agent events" on public.agent_events;
create policy "admins read agent events"
  on public.agent_events for select to authenticated
  using (public.is_admin());

revoke all on public.agent_events from anon, authenticated;
grant select on public.agent_events to authenticated;

-- Writes an event. It never raises, so logging can never block the real action.
create or replace function public.log_agent_event(p_agent uuid, p_event text, p_detail text default null, p_ref uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_agent is not null and public.is_agent_user(p_agent) then
    insert into public.agent_events (agent_id, event, detail, ref_id, actor_id)
    values (p_agent, p_event, p_detail, p_ref, auth.uid());
  end if;
exception when others then
  null;
end;
$$;
revoke all on function public.log_agent_event(uuid, text, text, uuid) from public, anon, authenticated;

-- 5a. agent signs up
create or replace function public.agent_events_on_agent_profile()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.log_agent_event(new.id, 'signed_up', new.agency_name, null);
  return null;
exception when others then
  return null;
end;
$$;
drop trigger if exists agent_events_agent_profile on public.agent_profiles;
create trigger agent_events_agent_profile after insert on public.agent_profiles
  for each row execute function public.agent_events_on_agent_profile();

-- 5b. identity verification
create or replace function public.agent_events_on_verification()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_agent_event(new.id, 'verification_submitted', null, null);
  elsif new.verification_status is distinct from old.verification_status then
    perform public.log_agent_event(new.id, 'verification_' || new.verification_status, null, null);
  end if;
  return null;
exception when others then
  return null;
end;
$$;
drop trigger if exists agent_events_verification on public.landlord_profiles;
create trigger agent_events_verification after insert or update on public.landlord_profiles
  for each row execute function public.agent_events_on_verification();

-- 5c. payments
create or replace function public.agent_events_on_payment()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_agent_event(new.agent_id, 'payment_submitted', new.currency || ' ' || new.amount::text, new.id);
  elsif new.status is distinct from old.status then
    perform public.log_agent_event(new.agent_id, 'payment_' || new.status, new.admin_note, new.id);
  end if;
  return null;
exception when others then
  return null;
end;
$$;
drop trigger if exists agent_events_payment on public.agent_payments;
create trigger agent_events_payment after insert or update on public.agent_payments
  for each row execute function public.agent_events_on_payment();

-- 5d. listings
create or replace function public.agent_events_on_property()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_agent_event(new.landlord_id, 'listing_created', new.title, new.id);
  elsif new.status is distinct from old.status then
    perform public.log_agent_event(new.landlord_id, 'listing_' || new.status, new.title, new.id);
  elsif auth.uid() is not distinct from new.landlord_id then
    perform public.log_agent_event(new.landlord_id, 'listing_edited', new.title, new.id);
  end if;
  return null;
exception when others then
  return null;
end;
$$;
drop trigger if exists agent_events_property on public.properties;
create trigger agent_events_property after insert or update on public.properties
  for each row execute function public.agent_events_on_property();

-- 5e. owner details
create or replace function public.agent_events_on_owner_details()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid;
begin
  select landlord_id into v_owner from public.properties where id = new.property_id;
  perform public.log_agent_event(v_owner, 'owner_details_saved', null, new.property_id);
  return null;
exception when others then
  return null;
end;
$$;
drop trigger if exists agent_events_owner_details on public.property_owner_details;
create trigger agent_events_owner_details after insert or update on public.property_owner_details
  for each row execute function public.agent_events_on_owner_details();

-- 5f. photos and videos
create or replace function public.agent_events_on_media()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid;
  v_property uuid := case when tg_op = 'DELETE' then old.property_id else new.property_id end;
begin
  select landlord_id into v_owner from public.properties where id = v_property;
  perform public.log_agent_event(v_owner, case when tg_op = 'DELETE' then 'media_removed' else 'media_added' end, null, v_property);
  return null;
exception when others then
  return null;
end;
$$;
drop trigger if exists agent_events_media on public.property_media;
create trigger agent_events_media after insert or delete on public.property_media
  for each row execute function public.agent_events_on_media();

-- 5g. reservation requests and the agent's answer
create or replace function public.agent_events_on_reservation()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid;
begin
  select landlord_id into v_owner from public.properties where id = new.property_id;
  if tg_op = 'INSERT' then
    perform public.log_agent_event(v_owner, 'reservation_requested', new.reference_code, new.id);
  elsif new.owner_response is distinct from old.owner_response and new.owner_response is not null then
    perform public.log_agent_event(v_owner, 'reservation_' || new.owner_response, new.reference_code, new.id);
  end if;
  return null;
exception when others then
  return null;
end;
$$;
drop trigger if exists agent_events_reservation on public.reservations;
create trigger agent_events_reservation after insert or update on public.reservations
  for each row execute function public.agent_events_on_reservation();

-- 5h. suspension
create or replace function public.agent_events_on_suspension()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.is_suspended is distinct from old.is_suspended then
    perform public.log_agent_event(new.id, case when new.is_suspended then 'suspended' else 'unsuspended' end, new.suspension_reason, null);
  end if;
  return null;
exception when others then
  return null;
end;
$$;
drop trigger if exists agent_events_suspension on public.profiles;
create trigger agent_events_suspension after update of is_suspended on public.profiles
  for each row execute function public.agent_events_on_suspension();

-- 6. Payment submitted: fill in the amount from the settings and tell the admins -------------------------------
create or replace function public.agent_payments_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  s jsonb := public.get_agent_fee_settings();
  v_state text := public.agent_access_state(new.agent_id);
begin
  if coalesce((s ->> 'amount')::numeric, 0) <= 0 then
    raise exception 'No agent fee is required right now.';
  end if;
  if v_state = 'revoked' then
    raise exception 'Your agent access has been switched off. Please contact Campus Crib.';
  end if;
  if v_state in ('active', 'waived') then
    raise exception 'Your agent access is already active.';
  end if;
  if v_state in ('provisional', 'awaiting_verification') then
    raise exception 'You already have a payment waiting to be checked.';
  end if;

  new.amount := (s ->> 'amount')::numeric;
  new.currency := s ->> 'currency';
  new.status := 'pending';
  return new;
end;
$$;
drop trigger if exists agent_payments_before_insert on public.agent_payments;
create trigger agent_payments_before_insert before insert on public.agent_payments
  for each row execute function public.agent_payments_before_insert();

create or replace function public.agent_payments_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  select name into v_name from public.profiles where id = new.agent_id;
  perform public.notify_admins('Agent ' || coalesce(v_name, '') || ' submitted a payment proof (' || new.currency || ' ' || new.amount::text || ') that needs checking.');
  return null;
exception when others then
  return null;
end;
$$;
drop trigger if exists agent_payments_after_insert on public.agent_payments;
create trigger agent_payments_after_insert after insert on public.agent_payments
  for each row execute function public.agent_payments_after_insert();

-- 7. Admin actions -----------------------------------------------------------------------------------
create or replace function public.admin_review_agent_payment(p_payment_id uuid, p_confirm boolean, p_note text default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  pay public.agent_payments%rowtype;
  v_days integer := coalesce((public.get_agent_fee_settings() ->> 'access_days')::integer, 0);
  v_note text := nullif(trim(coalesce(p_note, '')), '');
begin
  if not public.is_admin() then
    raise exception 'Only an admin can review payments.';
  end if;

  select * into pay from public.agent_payments where id = p_payment_id for update;
  if not found then
    raise exception 'Payment not found.';
  end if;
  if pay.status <> 'pending' then
    raise exception 'This payment has already been reviewed.';
  end if;

  if p_confirm then
    update public.agent_payments
    set status = 'confirmed',
        admin_note = v_note,
        reviewed_by = auth.uid(),
        reviewed_at = now(),
        access_from = now(),
        access_until = case when v_days > 0 then now() + (v_days || ' days')::interval else null end
    where id = pay.id;

    insert into public.notifications (user_id, message)
    values (pay.agent_id, 'Your agent payment was confirmed. Your agent access is active.');
  else
    if v_note is null then
      raise exception 'Please give a reason for rejecting the payment.';
    end if;
    update public.agent_payments
    set status = 'rejected', admin_note = v_note, reviewed_by = auth.uid(), reviewed_at = now()
    where id = pay.id;

    insert into public.notifications (user_id, message)
    values (pay.agent_id, 'Your agent payment proof was rejected: ' || v_note || '. Please submit a new proof.');
  end if;

  return true;
end;
$$;
revoke all on function public.admin_review_agent_payment(uuid, boolean, text) from public, anon;
grant execute on function public.admin_review_agent_payment(uuid, boolean, text) to authenticated;

create or replace function public.admin_set_agent_access(p_agent uuid, p_waived boolean, p_revoked boolean, p_note text default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only an admin can change agent access.';
  end if;
  if not public.is_agent_user(p_agent) then
    raise exception 'That account is not an agent.';
  end if;

  update public.agent_profiles set access_waived = coalesce(p_waived, false), access_revoked = coalesce(p_revoked, false)
  where id = p_agent;

  insert into public.agent_events (agent_id, event, detail, actor_id)
  values (
    p_agent,
    case when p_revoked then 'access_revoked' when p_waived then 'access_waived' else 'access_restored' end,
    nullif(trim(coalesce(p_note, '')), ''),
    auth.uid()
  );

  insert into public.notifications (user_id, message)
  values (
    p_agent,
    case when p_revoked then 'Your agent access was switched off by Campus Crib.'
         when p_waived then 'Campus Crib waived your agent fee. Your agent access is active.'
         else 'Your agent access was restored.' end
  );

  return true;
end;
$$;
revoke all on function public.admin_set_agent_access(uuid, boolean, boolean, text) from public, anon;
grant execute on function public.admin_set_agent_access(uuid, boolean, boolean, text) to authenticated;

create or replace function public.admin_agent_access_states()
returns table (agent_id uuid, state text, access_until timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only an admin can view agent access.';
  end if;

  return query
  select a.id,
         public.agent_access_state(a.id),
         (select max(p.access_until) from public.agent_payments p where p.agent_id = a.id and p.status = 'confirmed')
  from public.agent_profiles a;
end;
$$;
revoke all on function public.admin_agent_access_states() from public, anon;
grant execute on function public.admin_agent_access_states() to authenticated;

-- 8. Listings now also need active access (this replaces the function created in 43) ----------------------------
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
     and public.is_agent_user(v_owner) then

    if not public.agents_program_enabled() then
      raise exception 'The agent program is currently paused. Agents cannot add or edit listings right now.';
    end if;

    if not public.agent_has_access(v_owner) then
      raise exception 'Your agent access is not active. Pay the agent fee and submit your proof of payment first.';
    end if;
  end if;

  return new;
end;
$$;
