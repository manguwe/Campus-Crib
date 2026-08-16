import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { setActivityIdentity } from '../lib/activityIdentity'
import { logActivity } from '../lib/activityLog'

const AuthContext = createContext(undefined)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  // "loading" covers the whole startup sequence: has Supabase told us yet
  // whether there's an existing session, AND (if so) have we fetched the
  // matching profiles row? Until both are done we don't know who's logged
  // in or what role they have, so route protection can't decide anything.
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null)
      setActivityIdentity({ userId: null, role: null })
      return
    }
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, role, phone, is_suspended, suspension_reason, suspended_until, created_at')
      .eq('id', userId)
      .single()

    if (error) {
      // Not fatal - e.g. the on_auth_user_created trigger hasn't finished
      // yet on a brand-new signup. The caller can retry via refreshProfile().
      console.error('[AuthContext] could not load profile:', error.message)
      setProfile(null)
      setActivityIdentity({ userId, role: null })
    } else {
      setProfile(data)
      setActivityIdentity({ userId, role: data.role })
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    // On first mount, ask the Supabase client for whatever session it
    // already has. supabase-js persists sessions to localStorage and
    // auto-refreshes expired tokens by default, so this is what makes
    // "stay logged in after a page reload" work with zero extra code.
    supabase.auth.getSession().then(async ({ data: { session: initialSession } }) => {
      if (!isMounted) return
      setSession(initialSession)
      await loadProfile(initialSession?.user?.id)
      if (isMounted) setLoading(false)
    })

    // Subscribe to every future auth change: sign in, sign out, token
    // refresh, or the session arriving late (e.g. after clicking an email
    // confirmation link in another tab).
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      loadProfile(newSession?.user?.id).finally(() => {
        if (isMounted) setLoading(false)
      })
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [loadProfile])

  const signUp = useCallback(async ({ email, password, name, role, phone, termsAcceptedAt }) => {
    // Everything in `data` here lands in auth.users.raw_user_meta_data,
    // which the handle_new_user Postgres trigger reads to create the
    // matching profiles (and, for landlords, landlord_profiles) row
    // server-side. See 01_schema.sql / 04_auth_trigger_update.sql /
    // 16_terms_accepted_at.sql (terms_accepted_at).
    const result = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name, role, phone, terms_accepted_at: termsAcceptedAt } },
    })
    // role is already known from the caller here, so there's no need to
    // wait on the profile row (which the trigger above creates
    // separately) just to log this.
    if (!result.error) logActivity('signup', { details: { role } })
    return result
  }, [])

  const signIn = useCallback(async ({ email, password }) => {
    const result = await supabase.auth.signInWithPassword({ email, password })
    let role = null
    if (!result.error && result.data?.user) {
      // Awaited here (unlike the fire-and-forget log insert itself)
      // because the caller (Login.jsx) needs the role synchronously to
      // redirect to the right dashboard - this is a single indexed
      // lookup on a small table, not a meaningful delay.
      const { data } = await supabase.from('profiles').select('role').eq('id', result.data.user.id).single()
      role = data?.role ?? null
      logActivity('login', { details: { role } })
    }
    return { ...result, role }
  }, [])

  const signOut = useCallback(async () => {
    // Capture role before signing out - profile is cleared right after.
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
