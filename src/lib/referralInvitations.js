import { supabase } from './supabaseClient'

export async function getMyReferralSource() {
  const { data, error } = await supabase.rpc('ensure_my_referral_source')
  if (error) throw error
  return data
}

export async function recordInviteCreated(targetType) {
  const hasNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'
  const { error } = await supabase.rpc('record_referral_invite', {
    p_target_type: targetType,
    p_channel: hasNativeShare ? 'native_share' : 'copy',
    p_details: { source: 'invite_page' },
  })
  if (error) console.warn('[referralInvitations] invite event failed:', error.message)
}

export function buildReferralUrl(code) {
  if (!code || typeof window === 'undefined') return ''
  return `${window.location.origin}/?ref=${encodeURIComponent(code)}`
}
