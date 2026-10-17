import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { formatSupabaseError } from '../../lib/errorMessages'
import { setAgentsProgramEnabled } from '../../lib/agentsProgram'
import { useAgentsProgram } from '../../hooks/useAgentsProgram'
import PageLoading from '../ui/PageLoading'
import EmptyState from '../ui/EmptyState'
import ErrorBanner from '../ui/ErrorBanner'

const VERIFICATION_LABEL = { pending: 'Awaiting verification', approved: 'Verified', rejected: 'Rejected' }

export default function AdminAgents() {
  const { enabled, loading: switchLoading, refresh } = useAgentsProgram()
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [agents, setAgents] = useState([])
  const [verifications, setVerifications] = useState({})
  const [listings, setListings] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const { data, error: agentsError } = await supabase
      .from('agent_profiles')
      .select('id, agency_name, service_area, declaration_accepted, created_at, profiles(name, is_suspended)')
      .order('created_at', { ascending: false })

    if (agentsError) {
      setError(formatSupabaseError(agentsError, 'Could not load agents.'))
      setLoading(false)
      return
    }

    const rows = data || []
    const ids = rows.map((a) => a.id)
    const verificationMap = {}
    const listingMap = {}

    if (ids.length) {
      const [{ data: lps }, { data: props }] = await Promise.all([
        supabase.from('landlord_profiles').select('id, verification_status').in('id', ids),
        supabase.from('properties').select('id, landlord_id, status').in('landlord_id', ids),
      ])
      for (const lp of lps || []) verificationMap[lp.id] = lp.verification_status
      for (const p of props || []) {
        const entry = (listingMap[p.landlord_id] ||= { total: 0, approved: 0, pending: 0, rejected: 0 })
        entry.total += 1
        if (p.status in entry) entry[p.status] += 1
      }
    }

    setAgents(rows)
    setVerifications(verificationMap)
    setListings(listingMap)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const totals = useMemo(() => {
    const all = Object.values(listings)
    return {
      agents: agents.length,
      awaiting: agents.filter((a) => verifications[a.id] !== 'approved').length,
      listings: all.reduce((sum, l) => sum + l.total, 0),
    }
  }, [agents, verifications, listings])

  async function toggle() {
    const next = !enabled
    if (!next && !window.confirm('Pause the agent program? Agents will no longer be able to add or edit listings, and agent signup will be hidden.')) return
    setSaving(true)
    setMessage('')
    const { error: saveError } = await setAgentsProgramEnabled(next)
    if (saveError) setMessage(formatSupabaseError(saveError, 'Could not change the agent program.'))
    else {
      await refresh()
      setMessage(next ? 'Agent program is now ON.' : 'Agent program is now PAUSED.')
    }
    setSaving(false)
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-primary">Agent program</h2>
            <p className="text-sm text-gray-500 mt-1">
              {switchLoading
                ? 'Checking…'
                : enabled
                  ? 'ON: agents can sign up and post listings (every listing still needs admin approval).'
                  : 'PAUSED: agent signup is hidden and agents cannot add or edit listings. Their existing listings stay as they are.'}
            </p>
          </div>
          <button
            onClick={toggle}
            disabled={saving || switchLoading}
            className={`shrink-0 inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${enabled ? 'bg-amber-600 hover:bg-amber-700' : 'bg-primary hover:bg-primary-dark'}`}
          >
            {saving && <Loader2 size={15} className="animate-spin" />}
            {enabled ? 'Pause program' : 'Turn program on'}
          </button>
        </div>
        {message && <p className="mt-3 text-sm text-gray-600">{message}</p>}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          ['Agents', totals.agents],
          ['Not yet verified', totals.awaiting],
          ['Agent listings', totals.listings],
        ].map(([label, value]) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
            <p className="text-xs text-gray-500">{label}</p>
            <p className="text-2xl font-semibold text-primary mt-1">{value}</p>
          </div>
        ))}
      </div>

      <ErrorBanner message={error} />

      {loading ? (
        <PageLoading label="Loading agents…" />
      ) : agents.length === 0 ? (
        <EmptyState title="No agents yet" description="Agents appear here after they register. Verify them in the Landlord verifications tab." />
      ) : (
        <ul className="space-y-3">
          {agents.map((a) => {
            const l = listings[a.id] || { total: 0, approved: 0, pending: 0, rejected: 0 }
            return (
              <li key={a.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate">
                      {a.profiles?.name || 'Unnamed'}
                      {a.profiles?.is_suspended && <span className="ml-2 text-xs text-red-600">Suspended</span>}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {[a.agency_name, a.service_area].filter(Boolean).join(' · ') || 'No agency or area given'}
                    </p>
                  </div>
                  <span className="text-xs rounded-full bg-gray-100 text-gray-700 px-2 py-1">
                    {VERIFICATION_LABEL[verifications[a.id]] || 'No verification yet'}
                  </span>
                </div>
                <p className="text-xs text-gray-600 mt-3">
                  Listings: {l.total} total · {l.approved} live · {l.pending} awaiting approval · {l.rejected} rejected
                  {!a.declaration_accepted && <span className="text-amber-700"> · did not tick the owner-authorisation declaration</span>}
                </p>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
