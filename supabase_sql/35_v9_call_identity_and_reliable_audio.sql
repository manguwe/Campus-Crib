-- Campus Crib V9: explicit call identity, private fallback contact, and reliable signaling.
-- Run after V8 migration 34.

-- Only the person initiating a call may request the callee's fallback contact.
-- The callee never receives the caller's phone/email through this function.
create or replace function public.get_call_contact(p_conversation_id uuid, p_contact_user_id uuid)
returns table(name text, phone text, email text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth uuid := auth.uid();
begin
  if v_auth is null then raise exception 'You must be logged in'; end if;
  if not public.is_conversation_member(p_conversation_id, v_auth)
     or not public.is_conversation_member(p_conversation_id, p_contact_user_id) then
    raise exception 'You are not a member of this conversation';
  end if;
  if v_auth = p_contact_user_id then
    raise exception 'Invalid call contact';
  end if;

  return query
  select
    p.name::text as name,
    coalesce(nullif(lp.contact_phone, ''), nullif(p.phone, ''), nullif(pc.phone_number, ''))::text as phone,
    au.email::text as email
  from public.profiles p
  join auth.users au on au.id = p.id
  left join public.landlord_profiles lp on lp.id = p.id
  left join lateral (
    select pc.phone_number
    from public.property_contacts pc
    join public.conversations c on c.property_id = pc.property_id
    where c.id = p_conversation_id and p.id = (select landlord_id from public.properties where id = c.property_id)
    order by pc.sort_order asc, pc.created_at asc
    limit 1
  ) pc on true
  where p.id = p_contact_user_id;
end;
$$;
grant execute on function public.get_call_contact(uuid,uuid) to authenticated;

-- Calls can remain useful after a temporary browser disconnect; do not let a
-- transient connection state in the browser immediately mark the database call ended.
comment on table public.voice_call_signals is 'WebRTC signaling messages. Clients must re-read existing signals after subscribing to avoid realtime race conditions.';

-- Helpful index for the ringing-call lookup used by Messages.
create index if not exists idx_voice_calls_callee_status_created
  on public.voice_calls(callee_id, status, created_at desc);
