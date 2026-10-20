-- 47_reservations_r2_payments.sql
-- Reservations upgrade, stage 2: an optional reservation fee, paid outside the app, with proof of payment.
--
-- It all sits behind a switch that starts OFF. While the switch is off, reservations work exactly as in stage 1.
-- When it is on, after the owner or agent accepts a request:
--     the student has a limited time to pay and upload proof  ->  an admin checks the proof
--     ->  the reservation is confirmed.  No proof in time  ->  the request expires.
-- Only reservations accepted AFTER the switch is turned on are affected.
-- The app never handles money: it records the fee, the proof and who checked it.
-- Run after 45_reservations_r1.sql. Safe to run more than once.

-- 1. Settings --------------------------------------------------------------------------------
create or replace function public.reservation_payment_settings()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'enabled', coalesce((select value from public.platform_settings where key = 'reservation_payments'), 'off') = 'on',
    'fee_type', coalesce((select case when value in ('fixed', 'percent') then value end
                          from public.platform_settings where key = 'reservation_fee_type'), 'fixed'),
    'fee_value', coalesce((select case when value ~ '^[0-9]+(\.[0-9]+)?$' then value::numeric end
                           from public.platform_settings where key = 'reservation_fee_value'), 0),
    'currency', coalesce((select nullif(value, '') from public.platform_settings where key = 'reservation_fee_currency'), 'ZMW'),
    'hold_hours', coalesce((select case when value ~ '^[0-9]+$' then value::integer end
                            from public.platform_settings where key = 'reservation_hold_hours'), 48),
    'instructions', coalesce((select value from public.platform_settings where key = 'reservation_payment_instructions'), ''),
    'refund_policy', coalesce((select value from public.platform_settings where key = 'reservation_refund_policy'), '')
  );
$$;
revoke all on function public.reservation_payment_settings() from public, anon;
grant execute on function public.reservation_payment_settings() to authenticated;

create or replace function public.set_reservation_payment_settings(
  p_enabled boolean,
  p_fee_type text,
  p_fee_value numeric,
  p_currency text,
  p_hold_hours integer,
  p_instructions text,
  p_refund_policy text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only an admin can change reservation payments';
  end if;
  if p_fee_type is null or p_fee_type not in ('fixed', 'percent') then
    raise exception 'The fee type must be fixed or percent.';
  end if;
  if p_fee_value is null or p_fee_value < 0 then
    raise exception 'The fee cannot be negative.';
  end if;
  if p_fee_type = 'percent' and p_fee_value > 100 then
    raise exception 'A percentage cannot be more than 100.';
  end if;
  if p_hold_hours is null or p_hold_hours < 1 or p_hold_hours > 720 then
    raise exception 'The payment time must be between 1 and 720 hours.';
  end if;

  insert into public.platform_settings (key, value, updated_at, updated_by)
  values
    ('reservation_payments', case when p_enabled then 'on' else 'off' end, now(), auth.uid()),
    ('reservation_fee_type', p_fee_type, now(), auth.uid()),
    ('reservation_fee_value', p_fee_value::text, now(), auth.uid()),
    ('reservation_fee_currency', upper(coalesce(nullif(trim(p_currency), ''), 'ZMW')), now(), auth.uid()),
    ('reservation_hold_hours', p_hold_hours::text, now(), auth.uid()),
    ('reservation_payment_instructions', coalesce(p_instructions, ''), now(), auth.uid()),
    ('reservation_refund_policy', coalesce(p_refund_policy, ''), now(), auth.uid())
  on conflict (key) do update
    set value = excluded.value, updated_at = now(), updated_by = auth.uid();

  return true;
end;
$$;
revoke all on function public.set_reservation_payment_settings(boolean, text, numeric, text, integer, text, text) from public, anon;
grant execute on function public.set_reservation_payment_settings(boolean, text, numeric, text, integer, text, text) to authenticated;

-- 2. New columns on reservations -----------------------------------------------------------------
alter table public.reservations
  add column if not exists payment_status text not null default 'not_required'
    check (payment_status in ('not_required', 'awaiting_payment', 'proof_submitted', 'verified', 'rejected')),
  add column if not exists fee_amount numeric(12, 2),
  add column if not exists fee_currency text,
  add column if not exists pay_by timestamptz,
  add column if not exists payment_proof_path text,
  add column if not exists payment_note text,
  add column if not exists payment_submitted_at timestamptz,
  add column if not exists payment_reviewed_at timestamptz,
  add column if not exists payment_admin_note text;

-- 3. The fee for a listing (fixed amount, or a percentage of its monthly rent) ---------------------------
create or replace function public.reservation_fee_for(p_property uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  s jsonb := public.reservation_payment_settings();
  v_price numeric;
  v_currency text;
begin
  if s ->> 'fee_type' = 'percent' then
    select price, currency into v_price, v_currency from public.properties where id = p_property;
    return jsonb_build_object(
      'amount', round(coalesce(v_price, 0) * (s ->> 'fee_value')::numeric / 100, 2),
      'currency', coalesce(v_currency, s ->> 'currency')
    );
  end if;
  return jsonb_build_object('amount', round((s ->> 'fee_value')::numeric, 2), 'currency', s ->> 'currency');
end;
$$;
revoke all on function public.reservation_fee_for(uuid) from public, anon, authenticated;

-- 4. Requests also expire when the payment deadline passes (replaces the function from stage 1) -----------
create or replace function public.expire_stale_reservation_requests()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  with expired as (
    update public.reservations
    set status = 'expired', updated_at = now()
    where status = 'pending'
      and (
        (owner_response is null and respond_by is not null and respond_by < now())
        or (payment_status in ('awaiting_payment', 'rejected') and pay_by is not null and pay_by < now())
      )
    returning id, student_id, reference_code, payment_status
  ),
  notified as (
    insert into public.notifications (user_id, message)
    select student_id,
           case
             when payment_status in ('awaiting_payment', 'rejected')
               then 'Your reservation request (' || coalesce(reference_code, '') || ') expired because the payment was not received in time. You can request the room again.'
             else 'Your reservation request (' || coalesce(reference_code, '') || ') expired because the owner did not respond in time. You can request another room.'
           end
    from expired
    returning 1
  )
  select count(*) into v_count from expired;

  return v_count;
end;
$$;

-- 5. The owner accepts: start the payment step when the switch is on (replaces the function from stage 1) -------
create or replace function public.owner_respond_reservation(
  p_reservation_id uuid,
  p_accept boolean,
  p_note text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.reservations%rowtype;
  v_title text;
  v_note text := nullif(trim(coalesce(p_note, '')), '');
  s jsonb := public.reservation_payment_settings();
  fee jsonb;
  v_amount numeric;
  v_pay_by timestamptz;
begin
  if auth.uid() is null then
    raise exception 'You must be logged in.';
  end if;

  perform public.expire_stale_reservation_requests();

  select * into r from public.reservations where id = p_reservation_id for update;
  if not found then
    raise exception 'Reservation not found.';
  end if;

  select title into v_title from public.properties where id = r.property_id and landlord_id = auth.uid();
  if not found then
    raise exception 'Only the owner or agent of this listing can respond to the request.';
  end if;

  if r.status <> 'pending' then
    raise exception 'This request is no longer waiting for a response.';
  end if;
  if r.owner_response is not null then
    raise exception 'You have already responded to this request.';
  end if;

  if p_accept then
    fee := public.reservation_fee_for(r.property_id);
    v_amount := coalesce((fee ->> 'amount')::numeric, 0);

    if coalesce((s ->> 'enabled')::boolean, false) and v_amount > 0 then
      v_pay_by := now() + make_interval(hours => coalesce((s ->> 'hold_hours')::integer, 48));

      update public.reservations
      set owner_response = 'accepted', owner_note = v_note, owner_responded_at = now(),
          payment_status = 'awaiting_payment', fee_amount = v_amount, fee_currency = fee ->> 'currency', pay_by = v_pay_by
      where id = r.id;

      insert into public.reservation_events (reservation_id, actor_id, event, note)
      values (r.id, auth.uid(), 'owner_accepted', v_note);

      insert into public.notifications (user_id, message)
      values (
        r.student_id,
        'The owner accepted your reservation request (' || coalesce(r.reference_code, '') || '). Pay the reservation fee of '
          || (fee ->> 'currency') || ' ' || v_amount::text || ' by ' || to_char(v_pay_by, 'DD Mon YYYY HH24:MI')
          || ' to secure the room. Open Reservations for the payment details.'
      );
    else
      update public.reservations
      set owner_response = 'accepted', owner_note = v_note, owner_responded_at = now()
      where id = r.id;

      insert into public.reservation_events (reservation_id, actor_id, event, note)
      values (r.id, auth.uid(), 'owner_accepted', v_note);

      insert into public.notifications (user_id, message)
      values (
        r.student_id,
        'The owner accepted your reservation request (' || coalesce(r.reference_code, '') || '). Campus Crib will confirm it shortly.'
      );
      perform public.notify_admins(
        'A reservation request (' || coalesce(r.reference_code, '') || ') was accepted by the owner and needs confirming.'
      );
    end if;
  else
    update public.reservations
    set owner_response = 'declined', owner_note = v_note, owner_responded_at = now(), status = 'rejected'
    where id = r.id;

    insert into public.notifications (user_id, message)
    values (
      r.student_id,
      'The owner could not accept your reservation request (' || coalesce(r.reference_code, '') || '). You can request another room.'
    );
  end if;

  return true;
end;
$$;

-- 6. Admins cannot confirm a request whose fee is unverified, unless they use "Confirm anyway" -------------------
create or replace function public.reservations_guard_confirm_r1()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'pending'
     and new.status = 'confirmed'
     and coalesce(current_setting('campuscrib.confirm_override', true), '') <> 'on' then

    if coalesce(new.owner_response, '') <> 'accepted' then
      raise exception 'The owner or agent has not accepted this request yet. Use "Confirm anyway" only if you have agreed it with them directly.';
    end if;

    if old.payment_status in ('awaiting_payment', 'proof_submitted', 'rejected') then
      raise exception 'The reservation fee has not been verified yet. Check the payment proof first, or use "Confirm anyway".';
    end if;
  end if;
  return new;
end;
$$;

-- 7. The student submits proof of payment ------------------------------------------------------------------------
create or replace function public.submit_reservation_payment(
  p_reservation_id uuid,
  p_proof_path text,
  p_note text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.reservations%rowtype;
begin
  if auth.uid() is null then
    raise exception 'You must be logged in.';
  end if;

  perform public.expire_stale_reservation_requests();

  select * into r from public.reservations where id = p_reservation_id for update;
  if not found or r.student_id <> auth.uid() then
    raise exception 'Reservation not found.';
  end if;
  if r.status <> 'pending' then
    raise exception 'This reservation is no longer waiting for payment.';
  end if;
  if r.payment_status not in ('awaiting_payment', 'rejected') then
    raise exception 'No payment is due for this reservation.';
  end if;
  if r.pay_by is not null and r.pay_by < now() then
    raise exception 'The payment deadline has passed.';
  end if;
  if nullif(trim(coalesce(p_proof_path, '')), '') is null then
    raise exception 'Please upload your proof of payment.';
  end if;

  update public.reservations
  set payment_status = 'proof_submitted',
      payment_proof_path = p_proof_path,
      payment_note = nullif(trim(coalesce(p_note, '')), ''),
      payment_submitted_at = now(),
      payment_admin_note = null
  where id = r.id;

  insert into public.reservation_events (reservation_id, actor_id, event, note)
  values (r.id, auth.uid(), 'payment_submitted', nullif(trim(coalesce(p_note, '')), ''));

  perform public.notify_admins('A reservation payment proof (' || coalesce(r.reference_code, '') || ') needs checking.');
  return true;
end;
$$;
revoke all on function public.submit_reservation_payment(uuid, text, text) from public, anon;
grant execute on function public.submit_reservation_payment(uuid, text, text) to authenticated;

-- 8. An admin checks the proof: verify (which confirms the reservation) or reject -------------------------------
create or replace function public.admin_review_reservation_payment(
  p_reservation_id uuid,
  p_verify boolean,
  p_note text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.reservations%rowtype;
  v_note text := nullif(trim(coalesce(p_note, '')), '');
begin
  if not public.is_admin() then
    raise exception 'Only an admin can check payments.';
  end if;

  select * into r from public.reservations where id = p_reservation_id for update;
  if not found then
    raise exception 'Reservation not found.';
  end if;
  if r.payment_status <> 'proof_submitted' then
    raise exception 'There is no payment proof waiting to be checked.';
  end if;

  if p_verify then
    update public.reservations
    set payment_status = 'verified', payment_reviewed_at = now(), payment_admin_note = v_note
    where id = r.id;

    insert into public.reservation_events (reservation_id, actor_id, event, note)
    values (r.id, auth.uid(), 'payment_verified', v_note);

    perform public.admin_confirm_reservation(r.id, v_note);
  else
    if v_note is null then
      raise exception 'Please give a reason for rejecting the proof.';
    end if;

    update public.reservations
    set payment_status = 'rejected', payment_reviewed_at = now(), payment_admin_note = v_note
    where id = r.id;

    insert into public.reservation_events (reservation_id, actor_id, event, note)
    values (r.id, auth.uid(), 'payment_rejected', v_note);

    insert into public.notifications (user_id, message)
    values (
      r.student_id,
      'Your reservation payment proof (' || coalesce(r.reference_code, '') || ') was rejected: ' || v_note
        || '. Please submit a new proof before the deadline.'
    );
  end if;

  return true;
end;
$$;
revoke all on function public.admin_review_reservation_payment(uuid, boolean, text) from public, anon;
grant execute on function public.admin_review_reservation_payment(uuid, boolean, text) to authenticated;
