import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// We don't throw here even if the env vars are missing, because we want the
// app to still boot and show a clear "not configured" message in the UI
// (see src/pages/ConnectionTest.jsx) instead of a blank white screen.
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

if (!isSupabaseConfigured) {
  console.warn(
    '[supabaseClient] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. ' +
      'Copy .env.local.example to .env.local and fill in your Supabase project credentials.'
  )
}

// createClient still needs *some* string even when unconfigured, so we fall
// back to obviously-fake placeholders to avoid a hard crash on import.
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key'
)
