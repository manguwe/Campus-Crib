import { logActivity } from './activityLog'

// Module-level, not React state - this needs to survive route changes
// and fire from non-React event listeners (visibilitychange/beforeunload)
// without triggering re-renders.
let currentPath = null
let startedAt = null

function flush() {
  if (!currentPath || !startedAt) return
  const durationSeconds = Math.max(0, Math.round((Date.now() - startedAt) / 1000))
  logActivity('page_view', { path: currentPath, durationSeconds })
  startedAt = null // stop the clock; currentPath stays so resumeTracking() knows where to pick back up
}

/** Call on every route change. Logs the page_view row for the page just
 * left (with however long was spent on it) before starting the timer
 * for the new page. Best-effort, not perfectly precise - a tab closed
 * without a beforeunload/visibilitychange firing simply won't get a
 * final row, which is an accepted trade-off here. */
export function trackPageView(path) {
  flush()
  currentPath = path
  startedAt = Date.now()
}

/** Call when the tab is hidden or about to unload - logs whatever time
 * has accumulated on the current page so far. */
export function pauseTracking() {
  flush()
}

/** Call when the tab becomes visible again, so time spent after
 * returning counts toward the same page's duration. */
export function resumeTracking() {
  if (currentPath && !startedAt) startedAt = Date.now()
}
