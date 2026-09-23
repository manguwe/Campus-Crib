-- =========================================================================
-- Campus Crib — Push notifications: table + DB-driven dispatch
-- Run this in the Supabase SQL Editor.
--
-- ARCHITECTURE NOTE (read before running): the brief asks for a central
-- "notifyUser" helper so every existing notification-creation point
-- (verification, listing status, suspension, announcements) also
-- triggers a push send. Checking this project's actual code: NONE of
-- those insert into `notifications` from JavaScript - every one of them
-- is already a Postgres trigger that inserts directly
-- (notify_landlord_verification_change, notify_property_status_change,
-- notify_suspension_change, notify_manual_payment_review, plus the
-- admin_broadcast_announcement() RPC). There is no client-side
-- "notifyUser" call site to extend.
--
-- So instead of a JS helper, the single central point is made a
-- database trigger directly ON the notifications table itself: ANY
-- insert into notifications, from any of those existing triggers/RPCs,
-- present or future, automatically fires a push send - impossible to
-- bypass, and nothing else needs to change at any of the existing
-- call sites. This satisfies "future notification types automatically
-- get push too without duplicating this logic everywhere" more
-- completely than a JS helper would (a JS helper only covers
-- JS-originated inserts, and this project has none).
--
-- REQUIRES MANUAL SETUP - the trigger below calls the
-- send-push-notification Edge Function over HTTP via the pg_net
-- extension, which needs this project's own URL and a way to
-- authenticate the call. Postgres has no built-in way to know either
-- of those, so after running this migration, run these two commands
-- in the SQL Editor with YOUR project's real values (Project Settings
-- -> API in the Supabase dashboard):
--
--   alter database postgres set app.settings.supabase_url = 'https://YOUR-PROJECT-REF.supabase.co';
--   alter database postgres set app.settings.service_role_key = 'YOUR-SERVICE-ROLE-KEY';
--
-- Until both are set, the trigger below safely no-ops (catches the
-- error and lets the notification insert succeed regardless) - so
-- in-app/toast notifications keep working immediately, push just
-- won't send until this one-time setup step is done.
-- =========================================================================

create extension if not exists pg_net with schema extensions;

create table if not exists public.push_subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  created_at timestamptz default now()
);

alter table public.push_subscriptions enable row level security;

create policy "a user can view their own push subscriptions"
  on public.push_subscriptions for select
  using (user_id = auth.uid());

create policy "a user can create their own push subscription"
  on public.push_subscriptions for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "a user can delete their own push subscription"
  on public.push_subscriptions for delete
  using (user_id = auth.uid());

-- No admin/service-role SELECT policy is needed here: the
-- send-push-notification Edge Function is invoked with the service
-- role key, which bypasses RLS entirely for table reads - it can
-- already read every row regardless of policy.

create index if not exists idx_push_subscriptions_user_id on public.push_subscriptions (user_id);


-- ---------------------------------------------------------------------
-- Fires on every insert into notifications (from any source - the
-- triggers listed above, or any future one) and asynchronously calls
-- send-push-notification for that row's user_id. pg_net's http_post is
-- async/non-blocking and this function swallows any error, so a push
-- failure (missing setup, network issue, no subscriptions) can never
-- block or fail the notification insert itself.
--
-- Payload is intentionally simple given this schema: notifications only
-- has a `message` text column (no per-notification title/target url),
-- so every push uses a generic title ("Campus Crib") and links to "/"
-- (the site root) - clicking one just opens/focuses the app rather
-- than deep-linking to e.g. the specific listing that changed status.
-- ---------------------------------------------------------------------
create or replace function public.push_notification_on_insert()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_url text;
  v_key text;
begin
  begin
    v_url := current_setting('app.settings.supabase_url', true);
    v_key := current_setting('app.settings.service_role_key', true);

    if v_url is null or v_key is null or v_url = '' or v_key = '' then
      return new; -- manual setup step (see top of this file) not done yet - no-op
    end if;

    perform net.http_post(
      url := v_url || '/functions/v1/send-push-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_key
      ),
      body := jsonb_build_object(
        'user_id', new.user_id,
        'title', 'Campus Crib',
        'body', new.message,
        'url', '/'
      )
    );
  exception when others then
    -- Never let a push-dispatch failure block the notification insert.
    null;
  end;

  return new;
end;
$$;

drop trigger if exists notifications_push_on_insert on public.notifications;
create trigger notifications_push_on_insert
  after insert on public.notifications
  for each row
  execute function public.push_notification_on_insert();

-- Verify:
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'push_subscriptions'
order by ordinal_position;
