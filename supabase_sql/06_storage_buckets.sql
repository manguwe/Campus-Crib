-- =========================================================================
-- Student Boarding House Finder — Storage buckets
-- Run this in the Supabase SQL Editor.
--
-- Two buckets, two very different trust levels:
--   landlord-documents  (private) - ID documents. Never publicly readable.
--   property-media      (public)  - listing photos/videos. Meant to be
--                                    publicly viewable, like the listings
--                                    themselves once approved.
--
-- Path convention (this is what the storage policies below check against):
--   landlord-documents/{user_id}/{filename}
--   property-media/{user_id}/{property_id}/{filename}
-- The frontend's src/lib/storage.js builds paths this exact way.
-- =========================================================================

insert into storage.buckets (id, name, public)
values ('landlord-documents', 'landlord-documents', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('property-media', 'property-media', true)
on conflict (id) do nothing;

-- -------------------------------------------------------------------------
-- landlord-documents (private)
-- storage.foldername(name) splits the object path into an array, so for
-- 'abc123/passport.jpg' it returns ARRAY['abc123']. Checking that first
-- element against auth.uid() is what confines a landlord to their own
-- folder - they can never read or overwrite another landlord's document.
-- -------------------------------------------------------------------------
create policy "landlord can upload own id document"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'landlord-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "landlord or admin can view id document"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'landlord-documents'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
    )
  );

create policy "landlord can replace own id document"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'landlord-documents' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'landlord-documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "landlord can delete own id document"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'landlord-documents' and (storage.foldername(name))[1] = auth.uid()::text);

-- -------------------------------------------------------------------------
-- property-media (public)
-- Public SELECT so listing photos work as plain <img src="..."> URLs with
-- no auth header required - same as if you'd made the bucket public in
-- the dashboard. Write access is still locked to the uploader's own
-- {user_id} folder; which *property* that media belongs to is enforced
-- separately by the property_media table's own RLS policies (a row can
-- only be inserted if the landlord owns that property_id).
-- -------------------------------------------------------------------------
create policy "anyone can view property media"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'property-media');

create policy "landlord can upload media into their own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'property-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "landlord can update their own media"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'property-media' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'property-media' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "landlord can delete their own media"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'property-media' and (storage.foldername(name))[1] = auth.uid()::text);
