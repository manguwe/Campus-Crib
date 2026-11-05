import { supabase } from './supabaseClient'

let cached = null

/** Settings for the community popup, or null if they cannot be read. Cached for the page's lifetime. */
export async function fetchSitePromotions({ force = false } = {}) {
  if (cached && !force) return cached
  const { data, error } = await supabase.rpc('get_site_promotions')
  if (error) return null
  cached = data
  return data
}

export async function saveSitePromotions(form) {
  const { error } = await supabase.rpc('set_site_promotions', {
    p_enabled: form.enabled,
    p_partner_url: form.partnerUrl,
    p_partner_headline: form.partnerHeadline,
    p_whatsapp_url: form.whatsappUrl,
    p_tiktok_url: form.tiktokUrl,
    p_facebook_url: form.facebookUrl,
    p_instagram_url: form.instagramUrl,
    p_delay_seconds: Number(form.delaySeconds),
    p_repeat_days: Number(form.repeatDays),
  })
  if (error) throw error
  cached = null
}

// Only plain https links are ever used as a button address.
export const safeLink = (url) => (typeof url === 'string' && /^https:\/\/\S+$/.test(url) ? url : '')
export const OPEN_COMMUNITY_EVENT = 'open-community-prompt'
