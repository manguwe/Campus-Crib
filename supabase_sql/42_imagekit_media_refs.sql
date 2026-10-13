-- Campus Crib ImageKit cutover: additive reference only.
-- Safe to apply after reviewing the media-egress-cutover branch.
-- Does not move, delete, or alter existing Supabase Storage objects.
alter table public.property_media
  add column if not exists storage_file_id text;

comment on column public.property_media.storage_file_id is
  'ImageKit fileId for assets uploaded after the ImageKit cutover; null for legacy Supabase Storage media.';
