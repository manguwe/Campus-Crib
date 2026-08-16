import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { formatSupabaseError } from '../../lib/errorMessages'
import PageLoading from '../ui/PageLoading'
import ErrorBanner from '../ui/ErrorBanner'

function formatDuration(totalSeconds) {
  if (!totalSeconds) return '0s'
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes === 0) return `${seconds}s`
  return `${minutes}m ${seconds}s`
}

export default function AdminTraffic() {
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase.rpc('admin_traffic_summary')
      if (error) setError(formatSupabaseError(error, 'Could not load traffic data.'))
      else setSummary(data)
    }
    load()
  }, [])

  if (error) return <ErrorBanner message={error} />
  if (!summary) return <PageLoading label="Loading traffic data…" />

  const cards = [
    { label: 'Unique visitors today', value: summary.uniqueVisitors.today },
    { label: 'Unique visitors this week', value: summary.uniqueVisitors.week },
    { label: 'Unique visitors all-time', value: summary.uniqueVisitors.allTime },
    { label: 'Page views today', value: summary.pageViews.today },
    { label: 'Page views this week', value: summary.pageViews.week },
    { label: 'Page views all-time', value: summary.pageViews.allTime },
  ]

  const loggedIn = summary.loggedInVsGuest?.loggedIn ?? 0
  const guest = summary.loggedInVsGuest?.guest ?? 0
  const totalVisitors = loggedIn + guest
  const loggedInPct = totalVisitors ? Math.round((loggedIn / totalVisitors) * 100) : 0

  const maxPageViews = Math.max(1, ...(summary.topPages || []).map((p) => p.views))
  const maxCountryVisitors = Math.max(1, ...(summary.countries || []).map((c) => c.visitors))

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
            <p className="text-2xl font-bold text-gray-900">{c.value}</p>
            <p className="text-sm text-gray-500 mt-0.5">{c.label}</p>
          </div>
        ))}

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
          <p className="text-2xl font-bold text-gray-900">{formatDuration(summary.avgTimeOnSiteSeconds)}</p>
          <p className="text-sm text-gray-500 mt-0.5">Avg. time on site</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Top pages */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <p className="text-sm font-medium text-gray-900 mb-3">Top pages</p>
          {(summary.topPages || []).length === 0 ? (
            <p className="text-sm text-gray-400">No page views logged yet.</p>
          ) : (
            <div className="space-y-2.5">
              {summary.topPages.map((p) => (
                <div key={p.path}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-gray-700 truncate">{p.path}</span>
                    <span className="text-gray-400 shrink-0 ml-2">{p.views}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-gray-100">
                    <div
                      className="h-1.5 rounded-full bg-primary"
                      style={{ width: `${(p.views / maxPageViews) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Countries */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <p className="text-sm font-medium text-gray-900 mb-3">Visitors by country</p>
          {(summary.countries || []).length === 0 ? (
            <p className="text-sm text-gray-400">No country data resolved yet.</p>
          ) : (
            <div className="space-y-2.5">
              {summary.countries.map((c) => (
                <div key={c.country}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-gray-700 truncate">{c.country}</span>
                    <span className="text-gray-400 shrink-0 ml-2">{c.visitors}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-gray-100">
                    <div
                      className="h-1.5 rounded-full bg-accent"
                      style={{ width: `${(c.visitors / maxCountryVisitors) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Logged-in vs guest split */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <p className="text-sm font-medium text-gray-900 mb-3">Logged-in vs. guest visitors</p>
        {totalVisitors === 0 ? (
          <p className="text-sm text-gray-400">No visitors logged yet.</p>
        ) : (
          <>
            <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden flex">
              <div className="h-full bg-primary" style={{ width: `${loggedInPct}%` }} />
              <div className="h-full bg-gray-300" style={{ width: `${100 - loggedInPct}%` }} />
            </div>
            <div className="flex items-center justify-between text-xs text-gray-500 mt-2">
              <span>Logged in: {loggedIn} ({loggedInPct}%)</span>
              <span>Guest: {guest} ({100 - loggedInPct}%)</span>
            </div>
          </>
        )}
      </div>

      <p className="text-xs text-gray-400">
        Based on anonymous session identifiers only - no individual visitor is tracked across
        sessions or identified by IP.
      </p>
    </div>
  )
}
