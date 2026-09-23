-- =========================================================================
-- Student Boarding House Finder — Polish pass fixes
-- Run this after 11_notifications.sql.
--
-- RLS AUDIT FINDING: the "a user can insert their own profile" policy from
-- 02_policies.sql only ever checked `id = auth.uid()` - it never
-- restricted the `role` column at insert time. In the normal signup flow
-- this is unreachable, because handle_new_user() (SECURITY DEFINER,
-- 01_schema.sql) creates the profiles row automatically as part of the
-- same transaction as the auth.users insert, before the client ever gets
-- a chance to call anything. But it's still a real gap in the policy
-- itself: if a user's profiles row were ever missing for any reason (a
-- failed trigger, a manually-created auth user via the dashboard, a
-- future refactor that removes the trigger), that user could insert
-- their own profile directly via the client with role: 'admin' and grant
-- themselves admin. This closes it the same way role/is_suspended are
-- already protected on UPDATE (10_profile_privilege_fix_and_suspension.sql)
-- - by restricting what a non-admin can set at INSERT time too.
-- =========================================================================

drop policy if exists "a user can insert their own profile" on public.profiles;

create policy "a user can insert their own profile"
  on public.profiles for insert
  to authenticated
  with check (
    id = auth.uid()
    and role in ('student', 'landlord')
    and is_suspended = false
  );

-- Note: this does not affect handle_new_user(), which is SECURITY DEFINER
-- and therefore bypasses RLS entirely - admins are still only ever
-- created via the one-off SQL bootstrap in 05_create_first_admin.sql,
-- never through this policy.
