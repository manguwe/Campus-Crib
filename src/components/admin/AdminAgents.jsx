import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { formatSupabaseError } from '../../lib/errorMessages'
import {
  fetchAgentListingsVisible,
  setAgentListingsVisible,
  setAgentsProgramEnabled,
} from '../../lib/agentsProgram'
import { useAgentsProgram } from '../../hooks/useAgentsProgram'
import PageLoading from '../ui/PageLoading'
import EmptyState from '../ui/EmptyState'
import ErrorBanner from '../ui/ErrorBanner'

const VERIFICATION_LABEL = { pending: 'Awaiting verification', approved: 'Verified', rejected: 'Rejected' }
const EMPTY_STATS = {
  listings_total: 0,
  listings_live: 0,
  listings_pending: 0,
  listings_rejected: 0,
  enquiries: 0,
  reservations_total: 0,
  reservations_confirmed: 0,
  last_listing_at: null,
}

function SwitchCard({ title, description, buttonLabel, onClick, busy, disabled, tone = 'primary' }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-primary">{title}</h2>
          <p className="text-sm text-gray-500 mt-1">{description}</p>
        </div>
        <button
          onClick={onClick}
          disabled={busy || disabled}
          className={`shrink-0 inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${tone === 'warn' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-primary hover:bg-primary-dark'}`}
        >
          {busy && <Loader2 size={15} className="animate-spin" />}
          {buttonLabel}
        </button>
      </div>
    </div>
  )
}

export default function AdminAgents() {
  const { enabled, loading: switchLoading, refresh } = useAgentsProgram()
  const [listingsVisible, setListingsVisible] = useState(true)
  const [busySwitch, setBusySwitch] = useState('')
  const [message, setMessage] = useState('')
  const [agents, setAgents] = useState([])
  const [verifications, setVerifications] = useState({})
  const [stats, setStats] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyAgentId, setBusyAgentId] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const [{ data, error: agentsError }, { data: statRows, error: statsError }, visible] = await Promise.all([
      supabase
        .from('agent_profiles')
        .select('id, agency_name, service_area, declaration_accepted, created_at, profiles(name, is_suspended)')
        .order('created_at', { ascending: false }),
      supabase.rpc('admin_agent_stats'),
      fetchAgentListingsVisible(),
    ])

    setListingsVisible(visible)

    if (agentsError) {
      setError(formatSupabaseError(agentsError, 'Could not load agents.'))
      setLoading(false)
      return
    }
    if (statsError) setError(formatSupabaseError(statsError, 'Could not load agent statistics.'))

    const rows = data || []
    const ids = rows.map((a) => a.id)
    const verificationMap = {}
    if (ids.length) {
      const { data: lps } = await supabase.from('landlord_profiles').select('id, verification_status').in('id', ids)
      for (const lp of lps || []) verificationMap[lp.id] = lp.verification_status
    }

    const statMap = {}
    for (const s of statRows || []) statMap[s.agent_id] = s

    setAgents(rows)
    setVerifications(verificationMap)
    setStats(statMap)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const totals = useMemo(() => {
    const all = Object.values(stats)
    return {
      agents: agents.length,
      awaiting: agents.filter((a) => verifications[a.id] !== 'approved').length,
      listings: all.reduce((sum, s) => sum + Number(s.listings_total || 0), 0),
      reservations: all.reduce((sum, s) => sum + Number(s.reservations_total || 0), 0),
    }
  }, [agents, verifications, stats])

  async function toggleProgram() {
    const next = !enabled
    if (!next && !window.confirm('Pause the agent program? Agents will no longer be able to add or edit listings, and agent signup will be hidden.')) return
    setBusySwitch('program')
    setMessage('')
    const { error: saveError } = await setAgentsProgramEnabled(next)
    if (saveError) setMessage(formatSupabaseError(saveError, 'Could not change the agent program.'))
    else {
      await refresh()
      setMessage(next ? 'Agent program is now ON.' : 'Agent program is now PAUSED.')
    }
    setBusySwitch('')
  }

  async function toggleVisibility() {
    const next = !listingsVisible
    if (!next && !window.confirm('Hide all agent listings from the public? Students will no longer see them, including on existing reservations.')) return
    setBusySwitch('visibility')
    setMessage('')
    const { error: saveError } = await setAgentListingsVisible(next)
    if (saveError) setMessage(formatSupabaseError(saveError, 'Could not change agent listing visibility.'))
    else {
      setListingsVisible(next)
      setMessage(next ? 'Agent listings are now visible to the public.' : 'Agent listings are now hidden from the public.')
    }
    setBusySwitch('')
  }

  async function toggleSuspend(agent) {
    const suspended = Boolean(agent.profiles?.is_suspended)
    let reason = null
    if (suspended) {
      if (!window.confirm('Unsuspend this agent? Their listings become visible again.')) return
    } else {
      reason = window.prompt('Reason for suspending this agent (shown to them):')
      if (reason === null) return
      if (!reason.trim()) {
        setError('Please give a reason for the suspension.')
        return
      }
    }
    setBusyAgentId(agent.id)
    setError('')
    const { error: updateError } = await supabase
      .from('profiles')
      .update(
        suspended
          ? { is_suspended: false, suspension_reason: null, suspended_until: null }
          : { is_suspended: true, suspension_reason: reason.trim(), suspended_until: null },
      )
      .eq('id', agent.id)
    setBusyAgentId(null)
    if (updateError) setError(formatSupabaseError(updateError, 'Could not change this agent\'s suspension.'))
    else load()
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <SwitchCard
        title="Agent program"
        description={
          switchLoading
            ? 'Checking…'
            : enabled
              ? 'ON: agents can sign up and post listings (every listing still needs admin approval).'
              : 'PAUSED: agent signup is hidden and agents cannot add or edit listings.'
        }
        buttonLabel={enabled ? 'Pause program' : 'Turn program on'}
        onClick={toggleProgram}
        busy={busySwitch === 'program'}
        disabled={switchLoading}
        tone={enabled ? 'warn' : 'primary'}
      />

      <SwitchCard
        title="Agent listings in public"
        description={
          listingsVisible
            ? 'VISIBLE: approved agent listings show to students like any other listing.'
            : 'HIDDEN: students cannot see any agent listing. Agents and admins still can.'
        }
        buttonLabel={listingsVisible ? 'Hide agent listings' : 'Show agent listings'}
        onClick={toggleVisibility}
        busy={busySwitch === 'visibility'}
        tone={listingsVisible ? 'warn' : 'primary'}
      />

      {message && <p className="text-sm text-gray-600">{message}</p>}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          ['Agents', totals.agents],
          ['Not yet verified', totals.awaiting],
          ['Agent listings', totals.listings],
          ['Reservations', totals.reservations],
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
            const s = stats[a.id] || EMPTY_STATS
            const suspended = Boolean(a.profiles?.is_suspended)
            return (
              <li key={a.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate">
                      {a.profiles?.name || 'Unnamed'}
                      {suspended && <span className="ml-2 text-xs text-red-600">Suspended</span>}
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
                  Listings: {s.listings_total} total · {s.listings_live} live · {s.listings_pending} awaiting approval · {s.listings_rejected} rejected
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  Enquiries: {s.enquiries} · Reservations: {s.reservations_total} ({s.reservations_confirmed} confirmed) · Last listing:{' '}
                  {s.last_listing_at ? new Date(s.last_listing_at).toLocaleDateString() : 'none yet'}
                </p>
                {!a.declaration_accepted && (
                  <p className="text-xs text-amber-700 mt-1">Did not tick the owner-authorisation declaration.</p>
                )}
                <div className="mt-3">
                  <button
                    onClick={() => toggleSuspend(a)}
                    disabled={busyAgentId === a.id}
                    className="text-xs font-medium rounded-lg border border-gray-300 px-3 py-1.5 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    {busyAgentId === a.id ? 'Working…' : suspended ? 'Unsuspend agent' : 'Suspend agent'}
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
