-- =========================================================================
-- Student Boarding House Finder — Core Schema
-- Run this in the Supabase SQL Editor (Project > SQL Editor > New query).
-- Safe to run once on a fresh project. Re-running will error on
-- already-existing objects (by design, so you don't accidentally wipe data).
-- =========================================================================

create extension if not exists pgcrypto; -- gives us gen_random_uuid()

-- -------------------------------------------------------------------------
-- profiles
-- One row per auth.users row. Extends Supabase's built-in auth table with
-- app-specific fields (name, role, phone).
-- -------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  name        text not null,
  role        text not null check (role in ('student', 'landlord', 'admin')) default 'student',
  phone       text,
  created_at  timestamptz not null default now()
);

comment on table public.profiles is 'App-level profile data for every authenticated user, keyed to auth.users.';

-- Auto-create a profiles row whenever a new auth.users row appears (i.e.
-- whenever someone signs up). Pulls name/role out of the signup metadata
-- if the client passed it via supabase.auth.signUp({ options: { data: {...} } }),
-- otherwise falls back to sensible defaults so the row always satisfies
-- the NOT NULL / check constraints above.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, role, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', 'New User'),
    coalesce(new.raw_user_meta_data ->> 'role', 'student'),
    new.raw_user_meta_data ->> 'phone'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- -------------------------------------------------------------------------
-- landlord_profiles
-- Extra verification data, only relevant for users with role = 'landlord'.
-- 1:1 with profiles (id doubles as the foreign key and primary key).
-- -------------------------------------------------------------------------
create table public.landlord_profiles (
  id                  uuid primary key references public.profiles (id) on delete cascade,
  verification_status text not null check (verification_status in ('pending', 'approved', 'rejected')) default 'pending',
  id_document_url     text,
  verified_at         timestamptz,
  verified_by         uuid references public.profiles (id),
  created_at          timestamptz not null default now()
);

comment on table public.landlord_profiles is 'Verification state and ID document reference for landlord accounts.';

-- -------------------------------------------------------------------------
-- properties
-- -------------------------------------------------------------------------
create table public.properties (
  id            uuid primary key default gen_random_uuid(),
  landlord_id   uuid not null references public.landlord_profiles (id) on delete cascade,
  title         text not null,
  description   text,
  price         numeric(10, 2) not null check (price >= 0),
  currency      text not null default 'ZMW',
  address_text  text,
  latitude      double precision,
  longitude     double precision,
  room_type     text check (room_type in ('single', 'shared', 'self_contained', 'bedsitter', 'other')),
  amenities     jsonb not null default '[]'::jsonb,
  status        text not null check (status in ('pending', 'approved', 'rejected')) default 'pending',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.properties is 'Boarding house listings created by landlords, subject to admin approval.';

-- keep updated_at current on every row change
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger properties_set_updated_at
  before update on public.properties
  for each row
  execute function public.set_updated_at();

-- -------------------------------------------------------------------------
-- property_media
-- -------------------------------------------------------------------------
create table public.property_media (
  id          uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  media_type  text not null check (media_type in ('image', 'video')),
  url         text not null,
  sort_order  int not null default 0
);

comment on table public.property_media is 'Photos and video walkthroughs attached to a property listing.';

-- -------------------------------------------------------------------------
-- favourites
-- -------------------------------------------------------------------------
create table public.favourites (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.profiles (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (student_id, property_id)
);

comment on table public.favourites is 'Properties a student has shortlisted. One favourite per student per property.';

-- -------------------------------------------------------------------------
-- reviews
-- -------------------------------------------------------------------------
create table public.reviews (
  id          uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  student_id  uuid not null references public.profiles (id) on delete cascade,
  rating      int not null check (rating between 1 and 5),
  comment     text,
  created_at  timestamptz not null default now(),
  unique (student_id, property_id) -- one review per student per property
);

comment on table public.reviews is 'Student ratings/reviews of a property. One review per student per property.';

-- -------------------------------------------------------------------------
-- notifications
-- -------------------------------------------------------------------------
create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  message     text not null,
  is_read     boolean not null default false,
  created_at  timestamptz not null default now()
);

comment on table public.notifications is 'In-app notifications for a specific user (new matches, status changes, messages).';

-- -------------------------------------------------------------------------
-- Helper function used throughout the RLS policies (see 02_policies.sql).
-- SECURITY DEFINER lets it read public.profiles regardless of the calling
-- user's own RLS restrictions, which avoids recursive-policy problems when
-- other tables' policies need to ask "is the current user an admin?".
-- -------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

comment on function public.is_admin() is 'True if the currently authenticated user has role = admin. Used by RLS policies.';

-- helpful indexes for common queries
create index idx_properties_landlord_id on public.properties (landlord_id);
create index idx_properties_status on public.properties (status);
create index idx_property_media_property_id on public.property_media (property_id);
create index idx_favourites_student_id on public.favourites (student_id);
create index idx_reviews_property_id on public.reviews (property_id);
create index idx_notifications_user_id on public.notifications (user_id);
