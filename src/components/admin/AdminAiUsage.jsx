import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { formatSupabaseError } from '../../lib/errorMessages'
import PageLoading from '../ui/PageLoading'
import EmptyState from '../ui/EmptyState'
import ErrorBanner from '../ui/ErrorBanner'

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

export default function AdminAiUsage() {
  const [counts, setCounts] = useState(null)
  const [recent, setRecent] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError('')

      const weekAgo = new Date(Date.now() - WEEK_MS).toISOString()

      const [descAllTime, descWeek, searchAllTime, searchWeek, recentRows] = await Promise.all([
        supabase
          .from('activity_logs')
          .select('id', { count: 'exact', head: true })
          .eq('event_type', 'ai_description_generated'),
        supabase
          .from('activity_logs')
          .select('id', { count: 'exact', head: true })
          .eq('event_type', 'ai_description_generated')
          .gte('created_at', weekAgo),
        supabase
          .from('activity_logs')
          .select('id', { count: 'exact', head: true })
          .eq('event_type', 'ai_search_used'),
        supabase
          .from('activity_logs')
          .select('id', { count: 'exact', head: true })
          .eq('event_type', 'ai_search_used')
          .gte('created_at', weekAgo),
        supabase
          .from('activity_logs')
          .select('id, event_type, details, created_at, user_id, profiles(name)')
          .in('event_type', ['ai_description_generated', 'ai_search_used'])
          .order('created_at', { ascending: false })
          .limit(25),
      ])

      const firstError = [descAllTime, descWeek, searchAllTime, searchWeek, recentRows].find((r) => r.error)
      if (firstError) {
        setError(formatSupabaseError(firstError.error, 'Could not load AI usage data.'))
        setLoading(false)
        return
      }

      setCounts({
        descriptionsAllTime: descAllTime.count ?? 0,
        descriptionsWeek: descWeek.count ?? 0,
        searchesAllTime: searchAllTime.count ?? 0,
        searchesWeek: searchWeek.count ?? 0,
      })
      setRecent(recentRows.data || [])
      setLoading(false)
    }

    load()
  }, [])

  if (loading) return <PageLoading label="Loading AI usage…" />
  if (error) return <ErrorBanner message={error} />

  const cards = [
    { label: 'AI descriptions generated (all-time)', value: counts.descriptionsAllTime },
    { label: 'AI descriptions generated (this week)', value: counts.descriptionsWeek },
    { label: 'AI searches used (all-time)', value: counts.searchesAllTime },
    { label: 'AI searches used (this week)', value: counts.searchesWeek },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
            <p className="text-2xl font-bold text-gray-900">{c.value}</p>
            <p className="text-sm text-gray-500 mt-0.5">{c.label}</p>
          </div>
        ))}
      </div>

      <div>
        <p className="text-sm font-medium text-gray-900 mb-3">Recent AI activity</p>
        {recent.length === 0 ? (
          <EmptyState title="No AI activity yet" description="Usage of either AI feature will show up here." />
        ) : (
          <div className="space-y-2">
            {recent.map((r) => (
              <div key={r.id} className="bg-white rounded-2xl border border-gray-200 p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <p className="text-sm font-medium text-gray-900">
                    {r.profiles?.name || 'Guest'}
                    <span className="text-gray-400 font-normal">
                      {' — '}
                      {r.event_type === 'ai_description_generated'
                        ? 'generated a listing description'
                        : 'searched with AI'}
                    </span>
                  </p>
                  <span className="text-xs text-gray-400 shrink-0">
                    {new Date(r.created_at).toLocaleString()}
                  </span>
                </div>
                {r.event_type === 'ai_search_used' && r.details?.query && (
                  <p className="text-sm text-gray-600 mt-1.5 italic">"{r.details.query}"</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
