import { supabase } from './supabaseClient'
import { getSessionId } from './visitorSession'

export async function recordReferralInterest(details = null, userId = null) {
  const sessionId = getSessionId()
  if (!sessionId) return
  const key = 'cc_interest_signal_recorded'
  if (typeof window !== 'undefined' && localStorage.getItem(key)) return

  const { data, error } = await supabase.rpc('record_referral_interest_for_session', {
    p_session_id: sessionId,
    p_user_id: userId,
    p_details: details,
  })

  if (!error && data && typeof window !== 'undefined') localStorage.setItem(key, '1')
}
