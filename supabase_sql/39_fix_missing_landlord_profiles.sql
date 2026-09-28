-- Campus Crib V14 — repair landlord accounts missing their 1:1 verification row
-- Safe to run after migrations through 38.
-- This does not approve anyone; new rows always use the table default: pending.

insert into public.landlord_profiles (id)
select p.id
from public.profiles p
where p.role = 'landlord'
  and not exists (
    select 1
    from public.landlord_profiles lp
    where lp.id = p.id
  )
on conflict (id) do nothing;
