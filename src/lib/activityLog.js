import { supabase } from './supabaseClient'
import { getActivityIdentity } from './activityIdentity'
import { getSessionId, getCachedCountry } from './visitorSession'

/**
 * Logs one row to activity_logs. Deliberately fire-and-forget:
 * - Never `await` this in a caller - it returns nothing meaningful.
 * - A failed insert is swallowed (just console.warn'd), never thrown,
 *   so a logging hiccup can never break the actual user-facing action
 *   it's attached to (submitting a review, saving a listing, etc).
 *
 * user_id/role are read from the identity last pushed in by AuthContext
 * (see activityIdentity.js) - both are null for a guest, which the
 * activity_logs RLS policy explicitly allows.
 *
 * session_id/country come from visitorSession.js - a random per-browser
 * id and, once resolved, a country name. Neither is tied to login or
 * any other personally identifying value, and no raw IP is ever stored.
 * durationSeconds is optional and currently only populated for
 * 'page_view' events (see pageViewTracking.js).
 */
export function logActivity(eventType, { path, details, durationSeconds } = {}) {
  const { userId, role } = getActivityIdentity()

  supabase
    .from('activity_logs')
    .insert({
      user_id: userId,
      role,
      event_type: eventType,
      path: path ?? (typeof window !== 'undefined' ? window.location.pathname : null),
      details: details ?? null,
      session_id: getSessionId(),
      country: getCachedCountry(),
      duration_seconds: durationSeconds ?? null,
    })
    .then(({ error }) => {
      if (error) console.warn('[activityLog] failed to log', eventType, error.message)
    })
}
