-- =========================================================================
-- Campus Crib — Contact messages table
-- Run this in the Supabase SQL Editor.
-- Backs the Contact page form (role router: student / landlord /
-- university_partner / other). Mirrors the feedback table's RLS pattern
-- exactly: anyone (including anonymous/anon key) can insert, only admins
-- can read or update.
--
-- Note: the brief asked for this to be numbered 16_contact_messages_table
-- .sql, but 16_terms_accepted_at.sql already exists in this project from
-- an earlier phase, so this is 17_ instead to keep migration numbers
-- unique and in run order.
-- =========================================================================

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  role text not null,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.contact_messages enable row level security;

-- Anyone (including anonymous/anon key) can submit a contact message.
create policy "Anyone can submit a contact message"
  on public.contact_messages for insert
  with check (true);

-- Only admins can read contact messages (the inbox view).
create policy "Admins can read contact messages"
  on public.contact_messages for select
  using (
    exists (
      select 1 from public.profiles pr
      where pr.id = auth.uid() and pr.role = 'admin'
    )
  );

-- Only admins can update contact messages (mark as read).
create policy "Admins can update contact messages"
  on public.contact_messages for update
  using (
    exists (
      select 1 from public.profiles pr
      where pr.id = auth.uid() and pr.role = 'admin'
    )
  );

-- Verify:
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'contact_messages'
order by ordinal_position;
