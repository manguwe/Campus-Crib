-- Campus Crib V6: listing agent fees + proof-of-payment access control.
-- Students see the public/general location. Exact coordinates and landlord
-- contact details are returned only after an admin approves a payment request.

alter table public.properties
  add column if not exists agent_fee_amount numeric(10,2) not null default 0 check (agent_fee_amount >= 0),
  add column if not exists agent_fee_currency text not null default 'ZMW';

-- Public/general coordinates. Existing exact coordinates are migrated below,
-- then the sensitive columns are no longer exposed to anon/authenticated roles.
alter table public.properties
  add column if not exists public_latitude double precision,
  add column if not exists public_longitude double precision;

update public.properties
set public_latitude = round(latitude::numeric, 2)::double precision,
    public_longitude = round(longitude::numeric, 2)::double precision
where public_latitude is null and latitude is not null and longitude is not null;

create table if not exists public.property_access_requests (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(10,2) not null check (amount >= 0),
  currency text not null default 'ZMW',
  proof_path text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  review_note text,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id),
  unique (property_id, student_id, submitted_at)
);

create index if not exists idx_property_access_requests_property on public.property_access_requests(property_id);
create index if not exists idx_property_access_requests_student on public.property_access_requests(student_id);
create index if not exists idx_property_access_requests_status on public.property_access_requests(status);

alter table public.property_access_requests enable row level security;

drop policy if exists "Students can view their access requests" on public.property_access_requests;
create policy "Students can view their access requests"
  on public.property_access_requests for select to authenticated
  using (student_id = auth.uid() or public.is_admin());

drop policy if exists "Students can submit access requests" on public.property_access_requests;
create policy "Students can submit access requests"
  on public.property_access_requests for insert to authenticated
  with check (
    student_id = auth.uid()
    and exists (select 1 from public.properties p where p.id = property_id and p.status = 'approved')
  );

drop policy if exists "Students can update their pending access requests" on public.property_access_requests;
create policy "Students can update their pending access requests"
  on public.property_access_requests for update to authenticated
  using (student_id = auth.uid() and status = 'pending')
  with check (student_id = auth.uid() and status = 'pending');

drop policy if exists "Admins can update access requests" on public.property_access_requests;
create policy "Admins can update access requests"
  on public.property_access_requests for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Private exact location table. This keeps exact coordinates out of public listing reads.
create table if not exists public.property_private_locations (
  property_id uuid primary key references public.properties(id) on delete cascade,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  updated_at timestamptz not null default now()
);

alter table public.property_private_locations enable row level security;

drop policy if exists "Landlords and admins can manage private property locations" on public.property_private_locations;
create policy "Landlords and admins can manage private property locations"
  on public.property_private_locations for all to authenticated
  using (
    public.is_admin()
    or exists (select 1 from public.properties p where p.id = property_id and p.landlord_id = auth.uid())
  )
  with check (
    public.is_admin()
    or exists (select 1 from public.properties p where p.id = property_id and p.landlord_id = auth.uid())
  );

-- One-time migration of existing exact coordinates.
insert into public.property_private_locations(property_id, latitude, longitude)
select id, latitude, longitude
from public.properties
where latitude is not null and longitude is not null
on conflict (property_id) do update
set latitude = excluded.latitude,
    longitude = excluded.longitude,
    updated_at = now();

-- Exact columns remain for backwards compatibility in the schema, but are
-- explicitly denied to normal API roles. App code uses public_* or RPCs.
revoke select (latitude, longitude) on public.properties from anon, authenticated;

-- Keep normal listing reads working without exposing exact coordinates.
-- The explicit grant lists all non-sensitive property columns used by the app.
grant select (
  id, landlord_id, title, description, price, currency, address_text,
  room_type, amenities, status, created_at, updated_at,
  building_type, occupancy, toilet_shared_by, walk_minutes_to_campus,
  primary_campus_id, availability_status, rejection_reason,
  agent_fee_amount, agent_fee_currency, public_latitude, public_longitude
) on public.properties to anon, authenticated;

-- Private location save for landlords/admins.
create or replace function public.save_property_private_location(
  p_property_id uuid,
  p_latitude double precision,
  p_longitude double precision
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.is_admin() or exists (
    select 1 from public.properties p where p.id = p_property_id and p.landlord_id = auth.uid()
  )) then
    return false;
  end if;

  if p_latitude is null or p_longitude is null then
    delete from public.property_private_locations where property_id = p_property_id;
    update public.properties set public_latitude = null, public_longitude = null where id = p_property_id;
    return true;
  end if;

  insert into public.property_private_locations(property_id, latitude, longitude)
  values (p_property_id, p_latitude, p_longitude)
  on conflict (property_id) do update
    set latitude = excluded.latitude,
        longitude = excluded.longitude,
        updated_at = now();

  update public.properties
  set public_latitude = round(p_latitude::numeric, 2)::double precision,
      public_longitude = round(p_longitude::numeric, 2)::double precision
  where id = p_property_id;
  return true;
end;
$$;
grant execute on function public.save_property_private_location(uuid,double precision,double precision) to authenticated;

-- Student/admin access check.
create or replace function public.has_property_access(p_property_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_admin()
    or exists (
      select 1 from public.properties p
      where p.id = p_property_id and p.landlord_id = auth.uid()
    )
    or exists (
      select 1 from public.property_access_requests r
      where r.property_id = p_property_id
        and r.student_id = auth.uid()
        and r.status = 'approved'
    );
$$;
grant execute on function public.has_property_access(uuid,uuid) to authenticated;

-- Exact coordinates + contact phone(s) only for an approved access holder,
-- the landlord who owns the listing, or an admin.
create or replace function public.get_private_property_access(p_property_id uuid)
returns table (
  latitude double precision,
  longitude double precision,
  landlord_name text,
  landlord_phone text,
  contacts jsonb
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_property_access(p_property_id, auth.uid()) then
    raise exception 'Property access has not been approved';
  end if;

  return query
  select l.latitude,
         l.longitude,
         pr.name,
         pr.phone,
         coalesce((select jsonb_agg(jsonb_build_object(
           'id', pc.id,
           'contact_type', pc.contact_type,
           'phone_number', pc.phone_number,
           'label', pc.label,
           'sort_order', pc.sort_order
         ) order by pc.sort_order)
         from public.property_contacts pc where pc.property_id = p.id), '[]'::jsonb)
  from public.properties p
  join public.profiles pr on pr.id = p.landlord_id
  left join public.property_private_locations l on l.property_id = p.id
  where p.id = p_property_id;
end;
$$;
grant execute on function public.get_private_property_access(uuid) to authenticated;

-- Payment request RPC uses the current listing fee from the database, so a
-- student cannot choose a lower amount from the browser.
create or replace function public.create_property_access_request(
  p_property_id uuid,
  p_proof_path text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  result_id uuid;
  fee numeric;
  cur text;
begin
  if auth.uid() is null then raise exception 'You must be logged in'; end if;
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'student') then
    raise exception 'Only students can request property access';
  end if;
  select agent_fee_amount, agent_fee_currency into fee, cur
  from public.properties where id = p_property_id and status = 'approved';
  if fee is null then raise exception 'Listing not found or not approved'; end if;
  if fee <= 0 then
    insert into public.property_access_requests(property_id, student_id, amount, currency, proof_path, status, reviewed_at, reviewed_by)
    values (p_property_id, auth.uid(), fee, cur, null, 'approved', now(), auth.uid())
    returning id into result_id;
    return result_id;
  end if;
  insert into public.property_access_requests(property_id, student_id, amount, currency, proof_path)
  values (p_property_id, auth.uid(), fee, cur, nullif(p_proof_path, ''))
  returning id into result_id;
  return result_id;
end;
$$;
grant execute on function public.create_property_access_request(uuid,text) to authenticated;

-- A secure public read of just the fee; avoids exposing any private columns.
create or replace function public.get_property_agent_fee(p_property_id uuid)
returns table(agent_fee_amount numeric, agent_fee_currency text)
language sql
security definer
set search_path = public
stable
as $$
  select p.agent_fee_amount, p.agent_fee_currency
  from public.properties p
  where p.id = p_property_id and p.status = 'approved';
$$;
grant execute on function public.get_property_agent_fee(uuid) to anon, authenticated;

-- Private payment-proof storage.
insert into storage.buckets (id, name, public)
values ('payment-proofs', 'payment-proofs', false)
on conflict (id) do nothing;

drop policy if exists "Students can upload payment proofs" on storage.objects;
create policy "Students can upload payment proofs"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'payment-proofs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Students and admins can view payment proofs" on storage.objects;
create policy "Students and admins can view payment proofs"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'payment-proofs'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

-- Admin approval/rejection is explicit. Approved access becomes the durable grant.
create or replace function public.review_property_access_request(
  p_request_id uuid,
  p_decision text,
  p_note text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Only an admin can review access requests'; end if;
  if p_decision not in ('approved','rejected') then raise exception 'Invalid decision'; end if;
  update public.property_access_requests
  set status = p_decision,
      review_note = nullif(left(coalesce(p_note,''),1000),''),
      reviewed_at = now(),
      reviewed_by = auth.uid()
  where id = p_request_id;
  return found;
end;
$$;
grant execute on function public.review_property_access_request(uuid,text,text) to authenticated;

-- Feedback submission RPC: avoids client-side RLS friction for the public research form.
create or replace function public.submit_feedback_public(
  p_name text,
  p_email text,
  p_message text,
  p_user_type text default null,
  p_rating integer default null,
  p_suggestion text default null,
  p_feature_requests text default null,
  p_source text default 'feedback_page'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare result_id uuid;
begin
  insert into public.feedback(submitted_by, name, email, message, user_type, rating, suggestion, feature_requests, source)
  values (auth.uid(), nullif(left(coalesce(p_name,''),200),''), nullif(left(coalesce(p_email,''),320),''), left(p_message,10000),
          nullif(left(coalesce(p_user_type,''),50),''), p_rating, nullif(left(coalesce(p_suggestion,''),5000),''),
          nullif(left(coalesce(p_feature_requests,''),5000),''), left(coalesce(p_source,'feedback_page'),100));
  returning id into result_id;
  return result_id;
end;
$$;
grant execute on function public.submit_feedback_public(text,text,text,text,integer,text,text,text) to anon, authenticated;

-- Keep landlord registration phone private. Existing profiles policies expose
-- profile columns to authenticated users, so phone moves to a dedicated table.
create table if not exists public.private_landlord_contacts (
  landlord_id uuid primary key references public.profiles(id) on delete cascade,
  phone text,
  updated_at timestamptz not null default now()
);

alter table public.private_landlord_contacts enable row level security;
drop policy if exists "Landlords and admins can manage private landlord contacts" on public.private_landlord_contacts;
create policy "Landlords and admins can manage private landlord contacts"
  on public.private_landlord_contacts for all to authenticated
  using (landlord_id = auth.uid() or public.is_admin())
  with check (landlord_id = auth.uid() or public.is_admin());

insert into public.private_landlord_contacts(landlord_id, phone)
select id, phone from public.profiles
where role = 'landlord' and phone is not null
on conflict (landlord_id) do update set phone = excluded.phone, updated_at = now();

revoke select (phone) on public.profiles from anon, authenticated;

grant select (id, name, role, created_at, is_suspended, suspension_reason, suspended_until) on public.profiles to anon, authenticated;

create or replace function public.get_private_landlord_phone(p_landlord_id uuid)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select phone from public.private_landlord_contacts
  where landlord_id = p_landlord_id
    and (auth.uid() = p_landlord_id or public.is_admin() or exists (
      select 1 from public.property_access_requests r
      join public.properties p on p.id = r.property_id
      where p.landlord_id = p_landlord_id and r.student_id = auth.uid() and r.status = 'approved'
    ));
$$;
grant execute on function public.get_private_landlord_phone(uuid) to authenticated;

-- Refresh the signup trigger so future landlord phones are copied into the
-- private table and not left readable on profiles.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_role text := coalesce(new.raw_user_meta_data ->> 'role', 'student');
  new_phone text := new.raw_user_meta_data ->> 'phone';
begin
  insert into public.profiles (id, name, role, phone)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', 'New User'), new_role, null)
  on conflict (id) do nothing;
  if new_role = 'landlord' then
    insert into public.private_landlord_contacts(landlord_id, phone)
    values (new.id, new_phone)
    on conflict (landlord_id) do update set phone = excluded.phone, updated_at = now();
  end if;
  return new;
end;
$$;

create or replace function public.get_private_property_access(p_property_id uuid)
returns table (
  latitude double precision,
  longitude double precision,
  landlord_name text,
  landlord_phone text,
  contacts jsonb
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_property_access(p_property_id, auth.uid()) then
    raise exception 'Property access has not been approved';
  end if;
  return query
  select l.latitude,
         l.longitude,
         pr.name,
         plc.phone,
         coalesce((select jsonb_agg(jsonb_build_object(
           'id', pc.id, 'contact_type', pc.contact_type,
           'phone_number', pc.phone_number, 'label', pc.label, 'sort_order', pc.sort_order
         ) order by pc.sort_order) from public.property_contacts pc where pc.property_id = p.id), '[]'::jsonb)
  from public.properties p
  join public.profiles pr on pr.id = p.landlord_id
  left join public.private_landlord_contacts plc on plc.landlord_id = p.landlord_id
  left join public.property_private_locations l on l.property_id = p.id
  where p.id = p_property_id;
end;
$$;
