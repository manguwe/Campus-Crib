// activityLog.js needs to know "who is this" on every call, but it's a
// plain function (not a hook) so it can be called from anywhere -
// class components (ErrorBoundary), route-change effects, etc. Rather
// than re-fetching the session on every single log call, AuthContext
// pushes the current identity in here whenever it changes, and
// activityLog just reads the last-known value synchronously.
let currentIdentity = { userId: null, role: null }

export function setActivityIdentity({ userId, role }) {
  currentIdentity = { userId: userId ?? null, role: role ?? null }
}

export function getActivityIdentity() {
  return currentIdentity
}
