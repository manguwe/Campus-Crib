import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { formatSupabaseError } from '../../lib/errorMessages'
import { fetchReservationPaymentSettings, saveReservationPaymentSettings } from '../../lib/reservations'

const input = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent'

/** Admin: switch the reservation fee on or off and edit its settings. Starts OFF. */
export default function AdminReservationPayments() {
  const [form, setForm] = useState({
    enabled: false,
    feeType: 'fixed',
    feeValue: '0',
    currency: 'ZMW',
    holdHours: '48',
    instructions: '',
    refundPolicy: '',
  })
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    ;(async () => {
      const s = await fetchReservationPaymentSettings()
      if (s) {
        setForm({
          enabled: Boolean(s.enabled),
          feeType: s.fee_type || 'fixed',
          feeValue: String(s.fee_value ?? 0),
          currency: s.currency || 'ZMW',
          holdHours: String(s.hold_hours ?? 48),
          instructions: s.instructions || '',
          refundPolicy: s.refund_policy || '',
        })
      }
      setLoaded(true)
    })()
  }, [])

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setMessage('')
  }

  async function handleSave(e) {
    e.preventDefault()
    setError('')
    setMessage('')
    if (form.enabled && Number(form.feeValue) <= 0) {
      setError('Set a fee above 0 before switching reservation payments on.')
      return
    }
    setSaving(true)
    try {
      await saveReservationPaymentSettings(form)
      setMessage(form.enabled ? 'Saved. Reservation payments are ON for requests accepted from now on.' : 'Saved. Reservation payments are OFF.')
    } catch (err) {
      setError(formatSupabaseError(err, 'Could not save the settings.'))
    }
    setSaving(false)
  }

  return (
    <form onSubmit={handleSave} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
      <div>
        <h3 className="text-base font-semibold text-primary">Reservation fee</h3>
        <p className="text-sm text-gray-500 mt-1">
          When on, a student must pay a fee and upload proof within the time limit after the owner accepts. The app only records it; the money is paid outside.
          Reservations accepted before you switch it on are not affected.
        </p>
      </div>

      <label className="flex items-center gap-2 text-sm font-medium text-gray-800">
        <input
          type="checkbox"
          checked={form.enabled}
          onChange={(e) => update('enabled', e.target.checked)}
          className="rounded border-gray-300 text-accent focus:ring-accent"
          disabled={!loaded}
        />
        Require a reservation fee
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Fee type</label>
          <select value={form.feeType} onChange={(e) => update('feeType', e.target.value)} className={input} disabled={!loaded}>
            <option value="fixed">Fixed amount</option>
            <option value="percent">% of monthly rent</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{form.feeType === 'percent' ? 'Percent' : 'Amount'}</label>
          <input type="number" min="0" step="0.01" value={form.feeValue} onChange={(e) => update('feeValue', e.target.value)} className={input} disabled={!loaded} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
          <input type="text" value={form.currency} onChange={(e) => update('currency', e.target.value)} className={input} disabled={!loaded || form.feeType === 'percent'} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Hours to pay</label>
          <input type="number" min="1" max="720" step="1" value={form.holdHours} onChange={(e) => update('holdHours', e.target.value)} className={input} disabled={!loaded} />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Payment instructions shown to students</label>
        <textarea rows={3} value={form.instructions} onChange={(e) => update('instructions', e.target.value)} className={input} disabled={!loaded}
          placeholder={'e.g. Send to Airtel Money 09XXXXXXXX (Campus Crib).\nUse your reservation reference as the reference.'} />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Refund and cancellation policy shown to students</label>
        <textarea rows={3} value={form.refundPolicy} onChange={(e) => update('refundPolicy', e.target.value)} className={input} disabled={!loaded}
          placeholder="e.g. The fee is refundable if the owner cancels. It is not refundable if you cancel after it is verified." />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving || !loaded}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
        >
          {saving && <Loader2 size={15} className="animate-spin" />}
          Save reservation fee settings
        </button>
        {message && <span className="text-sm text-gray-600">{message}</span>}
      </div>
    </form>
  )
}
