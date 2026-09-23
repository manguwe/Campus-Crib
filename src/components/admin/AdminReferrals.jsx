import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { Copy, Link2, Plus, RefreshCw } from 'lucide-react'

const TYPES = [
  ['creator', 'Content creator'],
  ['student_ambassador', 'Student ambassador'],
  ['student', 'Student'],
  ['organization', 'Student organization'],
  ['landlord', 'Landlord'],
  ['caretaker', 'Caretaker'],
]

function Stat({ label, value }) {
  return <div className="bg-white border border-gray-200 rounded-xl p-4"><p className="text-xs text-gray-500">{label}</p><p className="text-2xl font-semibold text-primary mt-1">{value}</p></div>
}

export default function AdminReferrals() {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', code: '', type: 'creator', description: '', contact: '' })
  const [saving, setSaving] = useState(false)
  const [funnel, setFunnel] = useState([])

  async function load() {
    setLoading(true)
    setError('')
    const { data, error: rpcError } = await supabase.rpc('admin_referral_summary')
    const { data: funnelData, error: funnelError } = await supabase.rpc('admin_referral_funnel')
    if (rpcError || funnelError) setError((rpcError || funnelError).message)
    else { setSummary(data); setFunnel(funnelData || []) }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function createSource(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const payload = { ...form, name: form.name.trim(), code: form.code.trim().toUpperCase() }
    const { error: insertError } = await supabase.from('referral_sources').insert(payload)
    if (insertError) setError(insertError.message)
    else {
      setForm({ name: '', code: '', type: 'creator', description: '', contact: '' })
      setShowForm(false)
      await load()
    }
    setSaving(false)
  }

  async function copy(text) {
    try { await navigator.clipboard.writeText(text) } catch { /* clipboard can be unavailable */ }
  }

  if (loading) return <div className="text-sm text-gray-500">Loading referral analytics…</div>

  return (
    <div className="space-y-6">
      {error && <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm p-3">{error}</div>}

      <div className="flex items-center justify-between gap-3">
        <div><h2 className="text-lg font-semibold text-gray-900">Referral system</h2><p className="text-sm text-gray-500">Permanent attribution for creators, ambassadors, students and property partners.</p></div>
        <div className="flex gap-2">
          <button onClick={load} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50" title="Refresh"><RefreshCw size={16} /></button>
          <button onClick={() => setShowForm(v => !v)} className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-white px-3 py-2 text-sm"><Plus size={16} /> New source</button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Stat label="Referral visits" value={summary?.totalVisits ?? 0} />
        <Stat label="Referred users" value={summary?.referredUsers ?? 0} />
        <Stat label="Signups" value={summary?.signups ?? 0} />
        <Stat label="Feedback" value={summary?.feedback ?? 0} />
        <Stat label="Listings" value={summary?.listings ?? 0} />
      </div>

      {showForm && <form onSubmit={createSource} className="bg-white border border-gray-200 rounded-xl p-5 grid sm:grid-cols-2 gap-4">
        <input required placeholder="Source name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        <input required pattern="[A-Za-z0-9_-]+" placeholder="Unique code e.g. IDEA2026" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} className="rounded-lg border border-gray-300 px-3 py-2 text-sm uppercase" />
        <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">{TYPES.map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select>
        <input placeholder="Contact (optional)" value={form.contact} onChange={e => setForm({ ...form, contact: e.target.value })} className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        <input placeholder="Description (optional)" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="rounded-lg border border-gray-300 px-3 py-2 text-sm sm:col-span-2" />
        <button disabled={saving} className="sm:col-span-2 rounded-lg bg-primary text-white py-2 text-sm disabled:opacity-60">{saving ? 'Creating…' : 'Create referral source'}</button>
      </form>}

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 font-medium">Source funnel</div>
        <div className="overflow-x-auto"><table className="w-full text-xs"><thead className="bg-gray-50 text-gray-500"><tr>{['Source','Visits','Users','Interest','Signups','Profiles','Feedback','Listings','Invites'].map(h => <th key={h} className="text-left px-3 py-2 font-medium whitespace-nowrap">{h}</th>)}</tr></thead><tbody className="divide-y divide-gray-100">{funnel.map(row => <tr key={row.id}><td className="px-3 py-2 font-medium text-gray-800 whitespace-nowrap">{row.name}</td><td className="px-3 py-2">{row.visits}</td><td className="px-3 py-2">{row.users}</td><td className="px-3 py-2">{row.interest}</td><td className="px-3 py-2">{row.signups}</td><td className="px-3 py-2">{row.profiles}</td><td className="px-3 py-2">{row.feedback}</td><td className="px-3 py-2">{row.listings}</td><td className="px-3 py-2">{row.invites}</td></tr>)}{!funnel.length && <tr><td colSpan="9" className="px-3 py-5 text-gray-500">No source activity yet.</td></tr>}</tbody></table></div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 font-medium">Referral sources</div>
        <div className="divide-y divide-gray-100">
          {(summary?.sources || []).map(source => {
            const url = `${window.location.origin}/?ref=${encodeURIComponent(source.code)}`
            return <div key={source.id} className="p-4 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div><p className="font-medium text-gray-900">{source.name}</p><p className="text-xs text-gray-500">{source.type} · <span className="font-mono">{source.code}</span></p></div>
                <button onClick={() => copy(url)} className="inline-flex items-center gap-1.5 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 hover:bg-gray-50"><Copy size={13} /> Copy link</button>
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-500"><span>{source.visits} visits</span><span>{source.users} users</span><span>{source.signups} signups</span><span>{source.feedback} feedback</span><span>{source.listings} listings</span></div>
              <div className="flex items-center gap-1 text-xs text-gray-400 break-all"><Link2 size={13} />{url}</div>
            </div>
          })}
          {!summary?.sources?.length && <p className="p-6 text-sm text-gray-500">No referral sources yet. Create the first one above.</p>}
        </div>
      </div>
    </div>
  )
}
