-- =========================================================================
-- Student Boarding House Finder — defer profile creation to email
-- confirmation (OPTIONAL)
--
-- Do NOT run this until you've confirmed in the Supabase Dashboard
-- (Authentication -> Providers -> Email) that "Confirm email" is switched
-- ON. If it's off, auth.users rows get email_confirmed_at set
-- immediately at creation - there is no NULL -> timestamp transition for
-- this trigger to ever fire on, so no profile/landlord_profiles row
-- would ever be created and every signup would silently break. This is
-- purely a cleanliness improvement once email confirmation is
-- genuinely required; it is not itself the fix for "users can log in
-- unconfirmed" (that's the dashboard setting - unconfirmed users get no
-- session at all once it's on, regardless of when this trigger fires).
--
-- What this changes: handle_new_user() currently runs on INSERT into
-- auth.users, so the profiles/landlord_profiles rows exist immediately
-- at signup, before the person has confirmed their email. Harmless once
-- "Confirm email" is on (an unconfirmed user has no session, so that
-- early row is inert), but if you'd rather the rows simply not exist
-- until confirmation, this moves the trigger to UPDATE of
-- email_confirmed_at instead.
-- =========================================================================

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_email_confirmed
  after update of email_confirmed_at on auth.users
  for each row
  when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
  execute function public.handle_new_user();

-- handle_new_user() itself (04_auth_trigger_update.sql) is unchanged -
-- it already reads NEW.id / NEW.raw_user_meta_data, both of which are
-- still present on an UPDATE row, so no function changes are needed,
-- only which trigger event calls it.

-- To roll this back and go back to creating the profile at signup:
--   drop trigger if exists on_auth_user_email_confirmed on auth.users;
--   create trigger on_auth_user_created
--     after insert on auth.users
--     for each row execute function public.handle_new_user();
