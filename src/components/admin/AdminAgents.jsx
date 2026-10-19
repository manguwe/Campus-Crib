import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { formatSupabaseError } from '../../lib/errorMessages'
import {
  fetchAgentListingsVisible,
  setAgentAccess,
  setAgentListingsVisible,
  setAgentsProgramEnabled,
} from '../../lib/agentsProgram'
import AdminAgentFees from './AdminAgentFees'
import { useAgentsProgram } from '../../hooks/useAgentsProgram'
import PageLoading from '../ui/PageLoading'
import EmptyState from '../ui/EmptyState'
import ErrorBanner from '../ui/ErrorBanner'

const VERIFICATION_LABEL = { pending: 'Awaiting verification', approved: 'Verified', rejected: 'Rejected' }
const ACCESS_LABEL = {
  not_required: 'No fee required',
  waived: 'Fee waived',
  active: 'Access active',
  provisional: 'Access (proof being checked)',
  awaiting_verification: 'Proof awaiting check',
  expired: 'Access expired',
  rejected: 'Proof rejected',
  payment_needed: 'Payment needed',
  revoked: 'Access switched off',
}
const EVENT_LABEL = {
  signed_up: 'Signed up as an agent',
  verification_submitted: 'Submitted ID for verification',
  verification_approved: 'ID verified',
  verification_rejected: 'ID rejected',
  payment_submitted: 'Submitted proof of payment',
  payment_confirmed: 'Payment confirmed',
  payment_rejected: 'Payment rejected',
  access_waived: 'Fee waived by an admin',
  access_revoked: 'Access switched off by an admin',
  access_restored: 'Access restored by an admin',
  listing_created: 'Created a listing',
  listing_edited: 'Edited a listing',
  listing_pending: 'Listing sent for approval',
  listing_approved: 'Listing approved',
  listing_rejected: 'Listing rejected',
  owner_details_saved: 'Saved owner details',
  media_added: 'Added a photo or video',
  media_removed: 'Removed a photo or video',
  reservation_requested: 'Received a reservation request',
  reservation_accepted: 'Accepted a reservation request',
  reservation_declined: 'Declined a reservation request',
  suspended: 'Suspended',
  unsuspended: 'Unsuspended',
}
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
  const [accessStates, setAccessStates] = useState({})
  const [openActivity, setOpenActivity] = useState(null)
  const [activity, setActivity] = useState({})

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const [{ data, error: agentsError }, { data: statRows, error: statsError }, visible, { data: accessRows }] = await Promise.all([
      supabase
        .from('agent_profiles')
        .select('id, agency_name, service_area, declaration_accepted, created_at, access_waived, access_revoked, profiles(name, is_suspended)')
        .order('created_at', { ascending: false }),
      supabase.rpc('admin_agent_stats'),
      fetchAgentListingsVisible(),
      supabase.rpc('admin_agent_access_states'),
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

    setAccessStates(Object.fromEntries((accessRows || []).map((r) => [r.agent_id, r])))
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

  async function changeAccess(agent, { waived, revoked }, confirmText) {
    if (confirmText && !window.confirm(confirmText)) return
    setBusyAgentId(agent.id)
    setError('')
    try {
      await setAgentAccess(agent.id, { waived, revoked })
      await load()
    } catch (err) {
      setError(formatSupabaseError(err, 'Could not change this agent\'s access.'))
    }
    setBusyAgentId(null)
  }

  async function toggleActivity(agentId) {
    if (openActivity === agentId) {
      setOpenActivity(null)
      return
    }
    setOpenActivity(agentId)
    const { data } = await supabase
      .from('agent_events')
      .select('id, event, detail, created_at')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })
      .limit(100)
    setActivity((prev) => ({ ...prev, [agentId]: data || [] }))
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <AdminAgentFees onReviewed={load} />

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
                  <div className="flex flex-wrap gap-1.5">
                    <span className="text-xs rounded-full bg-gray-100 text-gray-700 px-2 py-1">
                      {VERIFICATION_LABEL[verifications[a.id]] || 'No verification yet'}
                    </span>
                    <span className="text-xs rounded-full bg-accent/10 text-accent px-2 py-1">
                      {ACCESS_LABEL[accessStates[a.id]?.state] || 'Access unknown'}
                      {accessStates[a.id]?.access_until ? ` · until ${new Date(accessStates[a.id].access_until).toLocaleDateString()}` : ''}
                    </span>
                  </div>
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
                <div className="mt-3 flex flex-wrap gap-2">
                  {a.access_revoked ? (
                    <button
                      onClick={() => changeAccess(a, { waived: a.access_waived, revoked: false })}
                      disabled={busyAgentId === a.id}
                      className="text-xs font-medium rounded-lg border border-gray-300 px-3 py-1.5 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Restore access
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => changeAccess(a, { waived: !a.access_waived, revoked: false })}
                        disabled={busyAgentId === a.id}
                        className="text-xs font-medium rounded-lg border border-gray-300 px-3 py-1.5 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        {a.access_waived ? 'Stop waiving fee' : 'Waive fee'}
                      </button>
                      <button
                        onClick={() => changeAccess(a, { waived: false, revoked: true }, 'Switch off this agent\'s access? They will not be able to add or edit listings.')}
                        disabled={busyAgentId === a.id}
                        className="text-xs font-medium rounded-lg border border-gray-300 px-3 py-1.5 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Switch off access
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => toggleActivity(a.id)}
                    className="text-xs font-medium rounded-lg border border-gray-300 px-3 py-1.5 text-gray-700 hover:bg-gray-50"
                  >
                    {openActivity === a.id ? 'Hide activity' : 'View activity'}
                  </button>
                  <button
                    onClick={() => toggleSuspend(a)}
                    disabled={busyAgentId === a.id}
                    className="text-xs font-medium rounded-lg border border-gray-300 px-3 py-1.5 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    {busyAgentId === a.id ? 'Working…' : suspended ? 'Unsuspend agent' : 'Suspend agent'}
                  </button>
                </div>
                {openActivity === a.id && (
                  <ol className="mt-3 space-y-2 border-l-2 border-gray-200 pl-4 max-h-72 overflow-y-auto">
                    {(activity[a.id] || []).length === 0 ? (
                      <li className="text-sm text-gray-500">No activity recorded yet.</li>
                    ) : (
                      (activity[a.id] || []).map((ev) => (
                        <li key={ev.id} className="text-sm">
                          <p className="font-medium text-gray-800">{EVENT_LABEL[ev.event] || ev.event}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(ev.created_at).toLocaleString()}
                            {ev.detail ? ` · ${ev.detail}` : ''}
                          </p>
                        </li>
                      ))
                    )}
                  </ol>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
