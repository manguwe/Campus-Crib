const SESSION_KEY = 'cc_session_id'
const COUNTRY_CACHE_KEY = 'cc_session_country'

function generateUuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  // Fallback for older browsers without crypto.randomUUID.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/** Random, anonymous per-browser identifier - not tied to login, IP, or
 * any other personally identifying value. Created once and reused for
 * the lifetime of this browser's localStorage. */
export function getSessionId() {
  if (typeof window === 'undefined') return null
  let id = localStorage.getItem(SESSION_KEY)
  if (!id) {
    id = generateUuid()
    localStorage.setItem(SESSION_KEY, id)
  }
  return id
}

let countryCache = undefined // undefined = not checked yet, null = resolved-but-unknown

export function getCachedCountry() {
  if (countryCache !== undefined) return countryCache
  if (typeof window === 'undefined') return null
  countryCache = localStorage.getItem(COUNTRY_CACHE_KEY) || null
  return countryCache
}

/** Fire-and-forget, best-effort, resolved at most once per session.
 * Only the country name is kept - city, region, and the caller's own IP
 * (all present in the API's response) are discarded immediately and
 * never stored anywhere. A failure here just leaves country as null on
 * logged events; it never blocks or throws. */
export function resolveCountryOnce() {
  if (typeof window === 'undefined') return
  if (localStorage.getItem(COUNTRY_CACHE_KEY)) {
    countryCache = localStorage.getItem(COUNTRY_CACHE_KEY)
    return
  }

  fetch('https://ipapi.co/json/')
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      const country = data?.country_name || data?.country || null
      if (country) {
        countryCache = country
        localStorage.setItem(COUNTRY_CACHE_KEY, country)
      }
    })
    .catch(() => {
      // Silent - country is a nice-to-have for the traffic summary, and
      // must never block or break page-view logging.
    })
}
