-- =========================================================================
-- Student Boarding House Finder — Property contact numbers (multiple, labeled)
-- Run this in the Supabase SQL Editor.
--
-- Replaces the earlier idea of 3 fixed columns (call/sms/whatsapp) with a
-- proper table, since a landlord may want to list an unlimited number of
-- contact numbers per property, each labeled by type.
-- =========================================================================

create table if not exists public.property_contacts (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  contact_type text not null check (contact_type in ('call', 'sms', 'whatsapp')),
  phone_number text not null,
  label text, -- optional, e.g. "Caretaker", "Landlord direct" if they want to distinguish
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.property_contacts enable row level security;

-- Anyone can read contacts for an approved property (mirrors property_media's
-- visibility rule).
create policy "Public can read contacts for approved properties"
  on public.property_contacts for select
  using (
    exists (
      select 1 from public.properties p
      where p.id = property_contacts.property_id
        and p.status = 'approved'
    )
  );

-- A landlord can read/write contacts only for their own properties
-- (covers both their own pending listings and their approved ones).
create policy "Landlords manage contacts for their own properties"
  on public.property_contacts for all
  using (
    exists (
      select 1 from public.properties p
      where p.id = property_contacts.property_id
        and p.landlord_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.properties p
      where p.id = property_contacts.property_id
        and p.landlord_id = auth.uid()
    )
  );

-- Admins can read everything (for moderation).
create policy "Admins can read all property contacts"
  on public.property_contacts for select
  using (
    exists (
      select 1 from public.profiles pr
      where pr.id = auth.uid() and pr.role = 'admin'
    )
  );

-- Verify:
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'property_contacts'
order by ordinal_position;
