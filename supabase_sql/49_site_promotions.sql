-- 49_site_promotions.sql
-- Community and partner-site promotion shown as a popup on the public pages.
-- Admins switch it on or off and edit the links from the admin "Promotions" tab. It starts OFF.
-- Safe to run more than once. Run in the Supabase SQL Editor or with psql.

create or replace function public.get_site_promotions()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'enabled', coalesce((select value from public.platform_settings where key = 'promo_enabled'), 'off') = 'on',
    'partner_url', coalesce((select nullif(value, '') from public.platform_settings where key = 'promo_partner_url'), 'https://campus-crib-agent.vercel.app'),
    'partner_headline', coalesce((select nullif(value, '') from public.platform_settings where key = 'promo_partner_headline'),
                                 'Know a boarding-house room near campus? Earn K20 for every approved room.'),
    'whatsapp_url', coalesce((select value from public.platform_settings where key = 'promo_whatsapp_url'), ''),
    'tiktok_url', coalesce((select value from public.platform_settings where key = 'promo_tiktok_url'), ''),
    'facebook_url', coalesce((select value from public.platform_settings where key = 'promo_facebook_url'), ''),
    'instagram_url', coalesce((select value from public.platform_settings where key = 'promo_instagram_url'), ''),
    'delay_seconds', coalesce((select case when value ~ '^[0-9]+$' then value::integer end
                               from public.platform_settings where key = 'promo_delay_seconds'), 25),
    'repeat_days', coalesce((select case when value ~ '^[0-9]+$' then value::integer end
                             from public.platform_settings where key = 'promo_repeat_days'), 3)
  );
$$;
revoke all on function public.get_site_promotions() from public;
grant execute on function public.get_site_promotions() to anon, authenticated;

create or replace function public.set_site_promotions(
  p_enabled boolean,
  p_partner_url text,
  p_partner_headline text,
  p_whatsapp_url text,
  p_tiktok_url text,
  p_facebook_url text,
  p_instagram_url text,
  p_delay_seconds integer,
  p_repeat_days integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link text;
begin
  if not public.is_admin() then
    raise exception 'Only an admin can change promotions';
  end if;

  -- every link must be empty or a plain https address (no javascript: or other tricks)
  foreach v_link in array array[p_partner_url, p_whatsapp_url, p_tiktok_url, p_facebook_url, p_instagram_url] loop
    if nullif(trim(coalesce(v_link, '')), '') is not null
       and (trim(v_link) !~ '^https://[^[:space:]]+$' or length(trim(v_link)) > 300) then
      raise exception 'Links must start with https:// and have no spaces.';
    end if;
  end loop;
  if length(coalesce(p_partner_headline, '')) > 160 then
    raise exception 'The headline can be at most 160 characters.';
  end if;
  if p_delay_seconds is null or p_delay_seconds < 5 or p_delay_seconds > 300 then
    raise exception 'The delay must be between 5 and 300 seconds.';
  end if;
  if p_repeat_days is null or p_repeat_days < 0 or p_repeat_days > 60 then
    raise exception 'Repeat days must be between 0 and 60.';
  end if;

  insert into public.platform_settings (key, value, updated_at, updated_by)
  values
    ('promo_enabled', case when p_enabled then 'on' else 'off' end, now(), auth.uid()),
    ('promo_partner_url', trim(coalesce(p_partner_url, '')), now(), auth.uid()),
    ('promo_partner_headline', trim(coalesce(p_partner_headline, '')), now(), auth.uid()),
    ('promo_whatsapp_url', trim(coalesce(p_whatsapp_url, '')), now(), auth.uid()),
    ('promo_tiktok_url', trim(coalesce(p_tiktok_url, '')), now(), auth.uid()),
    ('promo_facebook_url', trim(coalesce(p_facebook_url, '')), now(), auth.uid()),
    ('promo_instagram_url', trim(coalesce(p_instagram_url, '')), now(), auth.uid()),
    ('promo_delay_seconds', p_delay_seconds::text, now(), auth.uid()),
    ('promo_repeat_days', p_repeat_days::text, now(), auth.uid())
  on conflict (key) do update
    set value = excluded.value, updated_at = now(), updated_by = auth.uid();

  return true;
end;
$$;
revoke all on function public.set_site_promotions(boolean, text, text, text, text, text, text, integer, integer) from public, anon;
grant execute on function public.set_site_promotions(boolean, text, text, text, text, text, text, integer, integer) to authenticated;
