// Supabase/PostgREST/GoTrue errors come through as objects like
// { message, code, details, hint } and the raw `message` is often either
// a bare Postgres error ("new row violates row-level security policy for
// table \"properties\"") or an internal auth string that means nothing to
// a normal user. This maps the common ones we actually hit in this app to
// plain language, and falls back to a generic, still-readable message
// for anything unrecognised rather than dumping the raw object/string.
//
// Usage: catch (err) { setError(formatSupabaseError(err)) }

const PATTERNS = [
  // Auth (GoTrue) errors
  { test: /invalid login credentials/i, message: 'That email or password is incorrect.' },
  { test: /user already registered/i, message: 'An account with that email already exists — try logging in instead.' },
  { test: /email.*(invalid|not valid)/i, message: 'Please enter a valid email address.' },
  { test: /password.*(at least|should be)/i, message: 'Password must be at least 6 characters.' },
  { test: /rate limit/i, message: 'Too many attempts — please wait a moment and try again.' },
  { test: /email not confirmed/i, message: 'Please confirm your email address before logging in — check your inbox.' },

  // RLS / permission errors (row level security policy violations)
  {
    test: /row-level security policy/i,
    message: "That action isn't allowed for your account. If you think this is a mistake, contact support.",
  },
  {
    test: /only an admin can/i,
    message: 'Only an administrator can do that.',
  },

  // Postgres constraint errors
  { test: /duplicate key value violates unique constraint/i, message: 'That already exists — please use a different value.' },
  { test: /violates foreign key constraint/i, message: "That record couldn't be found — it may have been removed." },
  { test: /violates not-null constraint/i, message: 'Please fill in all required fields.' },
  { test: /violates check constraint "properties_price_check"/i, message: 'Price must be zero or greater.' },

  // Network
  { test: /failed to fetch|networkerror|network request failed/i, message: 'Network error — check your connection and try again.' },
]

export function formatSupabaseError(error, fallback = 'Something went wrong. Please try again.') {
  if (!error) return fallback

  const raw = typeof error === 'string' ? error : error.message || error.error_description || ''

  if (!raw) return fallback

  for (const { test, message } of PATTERNS) {
    if (test.test(raw)) return message
  }

  // Postgres messages are usually reasonably readable on their own once
  // stripped of the "duplicate key value violates..." style internals
  // above; if none of the known patterns matched, show it as-is rather
  // than hiding potentially useful detail, but keep it to one line.
  return raw.split('\n')[0]
}
