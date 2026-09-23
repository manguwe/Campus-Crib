import { supabase } from './supabaseClient'
import { getSessionId } from './visitorSession'

const REFERRAL_CODE_KEY = 'cc_referral_code'
const REFERRAL_SOURCE_KEY = 'cc_referral_source'

export function getStoredReferralCode() {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(REFERRAL_CODE_KEY)
}

export function captureReferralFromUrl() {
  if (typeof window === 'undefined') return
  const code = new URLSearchParams(window.location.search).get('ref')?.trim()
  if (!code) return

  localStorage.setItem(REFERRAL_CODE_KEY, code)
  const sessionId = getSessionId()

  supabase.rpc('capture_referral_visit', {
    p_code: code,
    p_session_id: sessionId,
    p_landing_page: window.location.pathname,
  }).then(({ data, error }) => {
    if (error) {
      console.warn('[referralTracking] capture failed:', error.message)
      return
    }
    if (data?.captured) {
      localStorage.setItem(REFERRAL_SOURCE_KEY, JSON.stringify({
        id: data.sourceId,
        name: data.sourceName,
        code: data.sourceCode,
      }))
    }
  })
}

export async function claimReferralForUser(userId, recordSignup = false) {
  const sessionId = getSessionId()
  if (!sessionId || !userId) return
  const { error } = await supabase.rpc('claim_referral_for_user', {
    p_session_id: sessionId,
    p_user_id: userId,
    p_record_signup: recordSignup,
  })
  if (error) console.warn('[referralTracking] claim failed:', error.message)
}

export async function recordReferralEvent(eventType, details = null, userId = null) {
  const sessionId = getSessionId()
  if (!sessionId) return
  const { error } = await supabase.rpc('record_referral_event_for_session', {
    p_session_id: sessionId,
    p_event_type: eventType,
    p_user_id: userId,
    p_details: details,
  })
  if (error) console.warn('[referralTracking] event failed:', error.message)
}

export function getReferralSource() {
  if (typeof window === 'undefined') return null
  try { return JSON.parse(localStorage.getItem(REFERRAL_SOURCE_KEY) || 'null') } catch { return null }
}
