-- =========================================================================
-- Campus Crib — Stronger landlord verification
-- Run this in the Supabase SQL Editor.
--
-- Adds typed ID number, front/back ID document, proof-of-ownership, and
-- contact fields to landlord_profiles for new submissions going forward.
-- The legacy id_document_url column is untouched - existing rows and
-- already-approved landlords who only ever had that single field are
-- completely unaffected by this migration (no backfill, no rename).
--
-- Also updates the two notify_landlord_verification_change() messages
-- (the trigger already added in 11_notifications.sql) to the new wording
-- - CREATE OR REPLACE, so the existing AFTER UPDATE trigger picks it up
-- automatically with no other change needed.
-- =========================================================================

alter table public.landlord_profiles
  add column if not exists id_number text,
  add column if not exists id_document_front_url text,
  add column if not exists id_document_back_url text,
  add column if not exists proof_of_ownership_url text,
  add column if not exists contact_phone text,
  add column if not exists contact_email text,
  add column if not exists contact_whatsapp text;

create or replace function public.notify_landlord_verification_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.verification_status = 'approved' then
    insert into public.notifications (user_id, message)
    values (new.id, 'You''re verified! You can now create listings on Campus Crib.');
  elsif new.verification_status = 'rejected' then
    insert into public.notifications (user_id, message)
    values (
      new.id,
      'Your verification needs another look'
      || case when coalesce(new.rejection_reason, '') <> '' then ': ' || new.rejection_reason else '' end
      || '. Please resubmit your documents.'
    );
  end if;
  return new;
end;
$$;

-- Verify:
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'landlord_profiles'
order by ordinal_position;
