import { useEffect, useState } from 'react'
import { Activity, BarChart3, CheckCircle2, MessageSquare, RefreshCw, Users } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'

function Stat({ label, value, icon: Icon }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-gray-500">{label}</p>
        <Icon size={16} className="text-accent" />
      </div>
      <p className="text-2xl font-semibold text-primary mt-2">{value}</p>
    </div>
  )
}

function pct(value, base) {
  if (!base) return '0%'
  return `${Math.round((value / base) * 100)}%`
}

export default function AdminLaunchReadiness() {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    const { data, error: rpcError } = await supabase.rpc('admin_launch_readiness_summary')
    if (rpcError) setError(rpcError.message)
    else setSummary(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  if (loading) return <div className="text-sm text-gray-500">Loading launch-readiness analytics…</div>

  const feedback = summary?.feedback || {}
  const referrals = summary?.referrals || {}

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Launch readiness</h2>
          <p className="text-sm text-gray-500 mt-1">Measure genuine pre-launch interest, research feedback, and referral activity before opening the marketplace.</p>
        </div>
        <button onClick={load} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50" title="Refresh"><RefreshCw size={16} /></button>
      </div>

      {error && <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm p-3">{error}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Current mode" value={String(summary?.mode || 'unknown').replaceAll('_', ' ')} icon={Activity} />
        <Stat label="Research feedback" value={feedback.total ?? 0} icon={MessageSquare} />
        <Stat label="Referral visitors" value={referrals.visits ?? 0} icon={Users} />
        <Stat label="Interest signals" value={referrals.interest ?? 0} icon={CheckCircle2} />
      </div>

      <section className="bg-white border border-gray-200 rounded-2xl p-5">
        <div className="flex items-center gap-2"><BarChart3 size={18} className="text-accent" /><h3 className="font-semibold text-gray-900">Referral funnel</h3></div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-5">
          {[
            ['Visits', referrals.visits || 0, referrals.visits || 0],
            ['Interest', referrals.interest || 0, referrals.visits || 0],
            ['Signups', referrals.signups || 0, referrals.users || referrals.visits || 0],
            ['Profiles', referrals.profiles || 0, referrals.signups || 0],
            ['Listings', referrals.listings || 0, referrals.profiles || referrals.signups || 0],
          ].map(([label, value, base]) => (
            <div key={label} className="rounded-xl bg-gray-50 p-3">
              <p className="text-xs text-gray-500">{label}</p>
              <p className="text-xl font-semibold text-primary mt-1">{value}</p>
              <p className="text-xs text-gray-400 mt-1">{pct(value, base)} conversion</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white border border-gray-200 rounded-2xl p-5">
        <h3 className="font-semibold text-gray-900">Research coverage</h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4">
          {[
            ['Students', feedback.students],
            ['Landlords', feedback.landlords],
            ['Caretakers', feedback.caretakers],
            ['Other', feedback.other],
            ['Avg. rating', feedback.averageRating || 0],
          ].map(([label, value]) => <div key={label} className="rounded-xl border border-gray-100 p-3"><p className="text-xs text-gray-500">{label}</p><p className="text-xl font-semibold text-primary mt-1">{value}</p></div>)}
        </div>
      </section>

      <div className="text-xs text-gray-500 flex flex-wrap gap-x-5 gap-y-2">
        <span>{summary?.activeSources ?? 0} active referral sources</span>
        <span>{summary?.invites ?? 0} invitations created</span>
        <span>{referrals.feedback ?? 0} referral-attributed feedback submissions</span>
      </div>
    </div>
  )
}
