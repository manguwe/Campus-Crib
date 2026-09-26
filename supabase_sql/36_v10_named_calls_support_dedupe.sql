-- Campus Crib V10: named calls, named support identity, and duplicate-support cleanup.
-- Run after V9 migration 35.

-- Keep a stable unique key for one user's support conversation with one admin.
alter table public.conversations
  add column if not exists support_pair_key text;

-- Populate keys for existing support conversations that have exactly two members.
do $$
declare
  r record;
  d record;
  keeper uuid;
begin
  for r in
    select c.id as conversation_id,
           array_agg(cm.user_id order by cm.user_id) as member_ids
    from public.conversations c
    join public.conversation_members cm on cm.conversation_id = c.id
    where c.kind = 'support'
    group by c.id
    having count(*) = 2
  loop
    update public.conversations
      set support_pair_key = r.member_ids[1]::text || ':' || r.member_ids[2]::text
      where id = r.conversation_id;
  end loop;

  for r in
    select support_pair_key
    from public.conversations
    where kind = 'support' and support_pair_key is not null
    group by support_pair_key
    having count(*) > 1
  loop
    select id into keeper
    from public.conversations
    where kind = 'support' and support_pair_key = r.support_pair_key
    order by created_at asc, id asc
    limit 1;

    for d in
      select id
      from public.conversations
      where kind = 'support' and support_pair_key = r.support_pair_key and id <> keeper
    loop
      update public.messages set conversation_id = keeper where conversation_id = d.id;
      update public.voice_calls set conversation_id = keeper where conversation_id = d.id;
      insert into public.conversation_members(conversation_id, user_id, joined_at, last_read_at)
        select keeper, user_id, joined_at, last_read_at
        from public.conversation_members
        where conversation_id = d.id
        on conflict (conversation_id, user_id) do nothing;
      delete from public.conversations where id = d.id;
    end loop;
  end loop;
end $$;

create unique index if not exists uq_support_pair_key
  on public.conversations(support_pair_key)
  where kind = 'support' and support_pair_key is not null;

create or replace function public.start_support_conversation()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conversation uuid;
  v_admin uuid;
  v_pair_key text;
  v_first uuid;
  v_second uuid;
begin
  if auth.uid() is null then raise exception 'You must be logged in'; end if;
  select id into v_admin from public.profiles where role = 'admin' order by created_at asc limit 1;
  if v_admin is null then raise exception 'Campus Crib support is not configured yet'; end if;

  if auth.uid() < v_admin then
    v_first := auth.uid(); v_second := v_admin;
  else
    v_first := v_admin; v_second := auth.uid();
  end if;
  v_pair_key := v_first::text || ':' || v_second::text;

  select id into v_conversation
  from public.conversations
  where kind = 'support' and support_pair_key = v_pair_key
  order by created_at asc
  limit 1;

  if v_conversation is null then
    insert into public.conversations(kind, created_by, support_pair_key)
    values ('support', auth.uid(), v_pair_key)
    returning id into v_conversation;
    insert into public.conversation_members(conversation_id, user_id)
      values (v_conversation, auth.uid()) on conflict do nothing;
    insert into public.conversation_members(conversation_id, user_id)
      values (v_conversation, v_admin) on conflict do nothing;
  end if;
  return v_conversation;
end;
$$;
grant execute on function public.start_support_conversation() to authenticated;

-- Return the actual caller/callee names for the active call. This avoids relying
-- on whichever conversation happens to be selected in the UI.
create or replace function public.get_voice_call_identity(p_call_id uuid)
returns table(caller_id uuid, caller_name text, callee_id uuid, callee_name text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth uuid := auth.uid();
begin
  if v_auth is null then raise exception 'You must be logged in'; end if;
  if not exists (
    select 1 from public.voice_calls vc
    where vc.id = p_call_id
      and (vc.caller_id = v_auth or vc.callee_id = v_auth or public.is_admin())
  ) then
    raise exception 'You are not a participant in this call';
  end if;

  return query
  select
    vc.caller_id,
    coalesce(nullif(cp.name, ''), 'Campus Crib user')::text,
    vc.callee_id,
    coalesce(nullif(ap.name, ''), 'Campus Crib user')::text
  from public.voice_calls vc
  join public.profiles cp on cp.id = vc.caller_id
  join public.profiles ap on ap.id = vc.callee_id
  where vc.id = p_call_id;
end;
$$;
grant execute on function public.get_voice_call_identity(uuid) to authenticated;

-- Useful indexes for named call and support lookup.
create index if not exists idx_conversations_support_pair
  on public.conversations(support_pair_key)
  where kind = 'support';
