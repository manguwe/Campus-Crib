-- =========================================================================
-- Student Boarding House Finder — Security fixes found while building the
-- landlord-facing features. Run this after 01-06.
--
-- GAP 1: properties INSERT had no restriction on the `status` column.
-- The 02_policies.sql INSERT policy only checked landlord_id and
-- verification, never status - so a landlord could bypass moderation
-- entirely by sending status: 'approved' directly in the insert payload
-- (the properties_protect_status trigger only guards UPDATE, not INSERT).
-- Fix: require status = 'pending' at insert time.
--
-- GAP 2: landlord_profiles INSERT had the same shape of hole - a client
-- could insert verification_status: 'approved' directly. In practice the
-- handle_new_user trigger already creates this row automatically, so a
-- normal signup never hits this policy - but if that row was ever missing
-- for any reason, this closes the loophole. Fix: require
-- verification_status = 'pending' at insert time.
--
-- GAP 3 (behavioural, not a hole): the original protect_landlord_
-- verification_fields trigger blocked ANY non-admin change to
-- verification_status - including a landlord legitimately resetting
-- their own rejected/approved status back to 'pending' after
-- re-uploading their ID document. Fix: allow a non-admin to move their
-- own status to 'pending' only (never to 'approved' or 'rejected'), and
-- always null out verified_at/verified_by on that change so stale
-- approval metadata doesn't linger against a listing that needs
-- re-review.
-- =========================================================================

-- ---- GAP 1: lock down properties INSERT ----
drop policy if exists "a verified landlord can create their own property" on public.properties;

create policy "a verified landlord can create their own property"
  on public.properties for insert
  to authenticated
  with check (
    landlord_id = auth.uid()
    and status = 'pending'
    and exists (
      select 1 from public.landlord_profiles lp
      where lp.id = auth.uid() and lp.verification_status = 'approved'
    )
  );

-- ---- GAP 2: lock down landlord_profiles INSERT ----
drop policy if exists "a landlord can create their own verification record" on public.landlord_profiles;

create policy "a landlord can create their own verification record"
  on public.landlord_profiles for insert
  to authenticated
  with check (
    id = auth.uid()
    and verification_status = 'pending'
  );

-- ---- GAP 3: let a landlord reset their own status to 'pending' ----
create or replace function public.protect_landlord_verification_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    -- admins may set verification_status/verified_at/verified_by freely
    return new;
  end if;

  if new.verification_status is distinct from old.verification_status then
    if new.verification_status <> 'pending' then
      raise exception 'Only an admin can approve or reject a landlord verification';
    end if;
  end if;

  -- Whatever a non-admin sends for these two columns is ignored - they're
  -- always admin-set, and get cleared whenever the landlord touches their
  -- own row (e.g. re-uploading a document) so an old approval can't look
  -- like it still applies to a resubmitted document.
  new.verified_at := null;
  new.verified_by := null;

  return new;
end;
$$;
