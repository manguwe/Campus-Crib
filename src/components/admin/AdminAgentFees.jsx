import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { formatSupabaseError } from '../../lib/errorMessages'
import { fetchAgentFeeSettings, reviewAgentPayment, saveAgentFeeSettings } from '../../lib/agentsProgram'
import { getAgentPaymentProofUrl } from '../../lib/storage'
import ErrorBanner from '../ui/ErrorBanner'

/** Admin: edit the agent access fee, and check the payment proofs agents have submitted. */
export default function AdminAgentFees({ onReviewed }) {
  const [form, setForm] = useState({ amount: '0', currency: 'ZMW', instructions: '', accessDays: '0', accessOnSubmit: true })
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState('')
  const [payments, setPayments] = useState([])
  const [names, setNames] = useState({})
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState('')

  const loadPayments = useCallback(async () => {
    const { data, error: loadError } = await supabase
      .from('agent_payments')
      .select('id, agent_id, amount, currency, proof_path, payer_note, created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
    if (loadError) {
      setError(formatSupabaseError(loadError, 'Could not load payments.'))
      return
    }
    const rows = data || []
    setPayments(rows)
    const ids = [...new Set(rows.map((p) => p.agent_id))]
    if (ids.length) {
      const { data: profiles } = await supabase.from('profiles').select('id, name').in('id', ids)
      setNames(Object.fromEntries((profiles || []).map((p) => [p.id, p.name])))
    }
  }, [])

  useEffect(() => {
    ;(async () => {
      try {
        const s = await fetchAgentFeeSettings()
        setForm({
          amount: String(s.amount ?? 0),
          currency: s.currency || 'ZMW',
          instructions: s.instructions || '',
          accessDays: String(s.access_days ?? 0),
          accessOnSubmit: s.access_on_submit !== false,
        })
      } catch (err) {
        setError(formatSupabaseError(err, 'Could not load the agent fee settings.'))
      }
      setLoaded(true)
      loadPayments()
    })()
  }, [loadPayments])

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setSaved('')
  }

  async function handleSave(e) {
    e.preventDefault()
    setError('')
    setSaved('')
    setSaving(true)
    try {
      await saveAgentFeeSettings(form)
      setSaved('Saved.')
    } catch (err) {
      setError(formatSupabaseError(err, 'Could not save the settings.'))
    }
    setSaving(false)
  }

  async function viewProof(payment) {
    setError('')
    try {
      const url = await getAgentPaymentProofUrl(payment.proof_path)
      window.open(url, '_blank', 'noopener')
    } catch (err) {
      setError(formatSupabaseError(err, 'Could not open the proof.'))
    }
  }

  async function review(payment, confirm) {
    let note = null
    if (!confirm) {
      note = window.prompt('Reason for rejecting this payment (shown to the agent):')
      if (note === null) return
      if (!note.trim()) {
        setError('Please give a reason for rejecting the payment.')
        return
      }
    } else if (!window.confirm('Confirm this payment? The agent gets full access.')) {
      return
    }
    setBusyId(payment.id)
    setError('')
    try {
      await reviewAgentPayment(payment.id, confirm, note)
      await loadPayments()
      await onReviewed?.()
    } catch (err) {
      setError(formatSupabaseError(err, 'Could not review the payment.'))
    }
    setBusyId(null)
  }

  const input = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent'

  return (
    <div className="space-y-6">
      <form onSubmit={handleSave} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-primary">Agent access fee</h2>
          <p className="text-sm text-gray-500 mt-1">
            Agents pay outside the app and upload proof. Set the amount to 0 if agents should not pay.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
            <input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => update('amount', e.target.value)} className={input} disabled={!loaded} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
            <input type="text" value={form.currency} onChange={(e) => update('currency', e.target.value)} className={input} disabled={!loaded} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Days of access (0 = no expiry)</label>
            <input type="number" min="0" step="1" value={form.accessDays} onChange={(e) => update('accessDays', e.target.value)} className={input} disabled={!loaded} />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Payment instructions shown to agents</label>
          <textarea
            rows={4}
            value={form.instructions}
            onChange={(e) => update('instructions', e.target.value)}
            className={input}
            placeholder={'e.g. Send to Airtel Money 09XXXXXXXX (Campus Crib).\nUse your full name as the reference.'}
            disabled={!loaded}
          />
        </div>
        <label className="flex items-start gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={form.accessOnSubmit}
            onChange={(e) => update('accessOnSubmit', e.target.checked)}
            className="mt-0.5 rounded border-gray-300 text-accent focus:ring-accent"
          />
          <span>Give access as soon as proof is submitted (you check it afterwards). Untick to give access only after you confirm the payment.</span>
        </label>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving || !loaded}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
          >
            {saving && <Loader2 size={15} className="animate-spin" />}
            Save fee settings
          </button>
          {saved && <span className="text-sm text-accent">{saved}</span>}
        </div>
      </form>

      <ErrorBanner message={error} />

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <h2 className="text-lg font-semibold text-primary">Payments to check ({payments.length})</h2>
        {payments.length === 0 ? (
          <p className="text-sm text-gray-500 mt-2">No payment proofs are waiting.</p>
        ) : (
          <ul className="mt-3 divide-y divide-gray-100">
            {payments.map((p) => (
              <li key={p.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">{names[p.agent_id] || 'Agent'} · {p.currency} {Number(p.amount).toLocaleString()}</p>
                  <p className="text-xs text-gray-500">
                    Submitted {new Date(p.created_at).toLocaleString()}
                    {p.payer_note ? ` · Ref: ${p.payer_note}` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  <button onClick={() => viewProof(p)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">View proof</button>
                  <button onClick={() => review(p, true)} disabled={busyId === p.id} className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Confirm</button>
                  <button onClick={() => review(p, false)} disabled={busyId === p.id} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 disabled:opacity-50">Reject</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
