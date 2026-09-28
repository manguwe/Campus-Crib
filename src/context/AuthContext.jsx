import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { setActivityIdentity } from '../lib/activityIdentity'
import { logActivity } from '../lib/activityLog'
import { claimReferralForUser } from '../lib/referralTracking'

const AuthContext = createContext(undefined)
const AUTH_TIMEOUT_MS = 12000
const PROFILE_TIMEOUT_MS = 7000

function withTimeout(promise, ms, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ])
}

function timeoutError(message) {
  const error = new Error(message)
  error.name = 'CampusCribTimeoutError'
  return error
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  // Startup must never depend indefinitely on a remote Supabase request.
  // If Supabase is slow/unreachable, the UI falls back to a logged-out state
  // instead of leaving every route on an infinite loading spinner.
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null)
      setActivityIdentity({ userId: null, role: null })
      return null
    }

    try {
      // Phone is deliberately not selected directly after V6 privacy
      // hardening. get_my_phone() returns only the current user's own phone.
      const profileResult = await withTimeout(
        supabase
          .from('profiles')
          .select('id, name, role, is_suspended, suspension_reason, suspended_until, created_at')
          .eq('id', userId)
          .maybeSingle(),
        PROFILE_TIMEOUT_MS,
        'Profile request timed out',
      )

      if (profileResult.error) throw profileResult.error
      if (!profileResult.data) {
        setProfile(null)
        setActivityIdentity({ userId, role: null })
        return null
      }

      let phone = ''
      try {
        const phoneResult = await withTimeout(
          supabase.rpc('get_my_phone'),
          PROFILE_TIMEOUT_MS,
          'Phone request timed out',
        )
        if (!phoneResult.error) phone = phoneResult.data || ''
      } catch (phoneError) {
        console.warn('[AuthContext] could not load own phone:', phoneError?.message || phoneError)
      }

      const nextProfile = { ...profileResult.data, phone }
      setProfile(nextProfile)
      setActivityIdentity({ userId, role: nextProfile.role })
      return nextProfile
    } catch (error) {
      console.error('[AuthContext] could not load profile:', error?.message || error)
      setProfile(null)
      setActivityIdentity({ userId, role: null })
      return null
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    async function processSession(nextSession) {
      if (!isMounted) return
      setSession(nextSession)

      await loadProfile(nextSession?.user?.id)
      if (nextSession?.user?.id) {
        // Best-effort attribution; never hold route rendering on referral work.
        try {
          await withTimeout(
            claimReferralForUser(nextSession.user.id),
            PROFILE_TIMEOUT_MS,
            'Referral attribution timed out',
          )
        } catch (error) {
          console.warn('[AuthContext] referral attribution skipped:', error?.message || error)
        }
      }

      if (isMounted) setLoading(false)
    }

    // Initial session lookup happens outside onAuthStateChange, so it is safe
    // to perform the follow-up profile query here.
    withTimeout(supabase.auth.getSession(), AUTH_TIMEOUT_MS, 'Authentication startup timed out')
      .then(({ data: { session: initialSession } }) => processSession(initialSession))
      .catch((error) => {
        console.warn('[AuthContext] startup session lookup failed:', error?.message || error)
        if (isMounted) {
          setSession(null)
          setProfile(null)
          setActivityIdentity({ userId: null, role: null })
          setLoading(false)
        }
      })

    // IMPORTANT: Supabase documents a deadlock risk when async Supabase
    // calls are made directly inside this callback. Keep the callback tiny
    // and move profile/referral work to the next task.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!isMounted) return
      setSession(newSession)
      window.setTimeout(() => {
        if (isMounted) processSession(newSession)
      }, 0)
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [loadProfile])

  const signUp = useCallback(async ({ email, password, name, role, phone, termsAcceptedAt }) => {
    let result
    try {
      result = await withTimeout(
        supabase.auth.signUp({
          email,
          password,
          options: { data: { name, role, phone, terms_accepted_at: termsAcceptedAt } },
        }),
        AUTH_TIMEOUT_MS,
        'Registration request timed out',
      )
    } catch (error) {
      return { data: null, error: timeoutError(error?.message || 'Registration request timed out') }
    }

    if (!result.error) {
      logActivity('signup', { details: { role } })
      if (result.data?.session?.user?.id) {
        try {
          await claimReferralForUser(result.data.session.user.id, true)
        } catch {
          // Attribution is non-critical to account creation.
        }
      }
    }
    return result
  }, [])

  const signIn = useCallback(async ({ email, password }) => {
    let result
    try {
      result = await withTimeout(
        supabase.auth.signInWithPassword({ email, password }),
        AUTH_TIMEOUT_MS,
        'Login request timed out',
      )
    } catch (error) {
      return { data: null, error: timeoutError(error?.message || 'Login request timed out'), role: null }
    }

    let role = null
    if (!result.error && result.data?.user) {
      try {
        const roleResult = await withTimeout(
          supabase.from('profiles').select('role').eq('id', result.data.user.id).maybeSingle(),
          PROFILE_TIMEOUT_MS,
          'Role lookup timed out',
        )
        role = roleResult.data?.role ?? null
      } catch (error) {
        console.warn('[AuthContext] role lookup failed:', error?.message || error)
      }
      logActivity('login', { details: { role } })
    }
    return { ...result, role }
  }, [])

  const signOut = useCallback(async () => {
    logActivity('logout', { details: { role: profile?.role ?? null } })
    await supabase.auth.signOut()
  }, [profile])

  const refreshProfile = useCallback(() => {
    return loadProfile(session?.user?.id)
  }, [loadProfile, session])

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    role: profile?.role ?? null,
    loading,
    signUp,
    signIn,
    signOut,
    refreshProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (ctx === undefined) {
    throw new Error('useAuth must be used within an <AuthProvider>')
  }
  return ctx
}
