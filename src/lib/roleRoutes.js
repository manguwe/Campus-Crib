/**
 * Maps a profile role to its dashboard route. Returns null for an
 * unrecognized/missing role rather than a fallback path like '/' -
 * callers that redirect on this (Home.jsx redirecting a logged-in
 * visitor away from the landing page, in particular) need to be able to
 * tell "no known destination" apart from "the destination is home",
 * otherwise a null role could cause a redirect-to-self loop.
 */
export function dashboardPathForRole(role) {
  if (role === 'admin') return '/admin'
  if (role === 'landlord') return '/landlord'
  if (role === 'student') return '/student'
  return null
}
