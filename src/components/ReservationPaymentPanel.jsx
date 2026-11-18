import { useEffect, useState } from 'react'
import { CheckCircle2, Clock3, Smartphone, Upload } from 'lucide-react'
import { fetchReservationPaymentSettings, submitReservationPayment } from '../lib/reservations'
import { fetchReservationPaymentNumbers } from '../lib/roomAccess'
import { discardPrivateUpload, uploadReservationProof } from '../lib/storage'
import { formatSupabaseError } from '../lib/errorMessages'

/** Shows the payment step for a reservation the admin has accepted: mobile money numbers,
 * instructions, and the proof upload. Shown in both the room page and the Reservations page. */
export default function ReservationPaymentPanel({ reservation, onChanged }) {
  const [numbers, setNumbers] = useState([])
  const [instructions, setInstructions] = useState('')
  const [file, setFile] = useState(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const status = reservation?.payment_status
  const needsPayment = status === 'awaiting_payment' || status === 'rejected'

  useEffect(() => {
    if (!needsPayment) return
    fetchReservationPaymentNumbers().then(setNumbers).catch(() => setNumbers([]))
    fetchReservationPaymentSettings().then((s) => setInstructions(s?.instructions || '')).catch(() => {})
  }, [needsPayment])

  if (!reservation || !status || status === 'not_required') return null

  async function submit(e) {
    e.preventDefault()
    if (!file) { setError('Please choose a photo or PDF of your payment confirmation.'); return }
    setError(''); setBusy(true)
    let reference = null
    try {
      reference = await uploadReservationProof(file)
      await submitReservationPayment({ id: reservation.id, proofPath: reference, note })
      setFile(null); setNote('')
      onChanged?.()
    } catch (err) {
      if (reference) discardPrivateUpload(reference, 'reservation-proof').catch(() => {})
      setError(formatSupabaseError(err, 'Could not send your proof of payment.'))
    } finally { setBusy(false) }
  }

  const amount = reservation.fee_amount != null ? `${reservation.fee_currency || 'ZMW'} ${Number(reservation.fee_amount).toLocaleString()}` : null

  if (status === 'proof_submitted') {
    return (
      <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-4 flex items-start gap-3">
        <Clock3 className="text-blue-700 shrink-0 mt-0.5" size={18} />
        <p className="text-sm text-blue-900">Payment proof received. Campus Crib is checking it, and directions will unlock once it is verified.</p>
      </div>
    )
  }

  if (status === 'verified') {
    return (
      <div className="mt-4 rounded-2xl border border-green-100 bg-green-50 p-4 flex items-start gap-3">
        <CheckCircle2 className="text-green-700 shrink-0 mt-0.5" size={18} />
        <p className="text-sm text-green-900">Payment verified{reservation.reference_code ? ` · Ref ${reservation.reference_code}` : ''}.</p>
      </div>
    )
  }

  return (
    <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4 space-y-4">
      <div>
        <h3 className="font-bold text-primary flex items-center gap-2"><Smartphone size={18}/> Pay to secure this room</h3>
        {amount && <p className="text-sm text-gray-700 mt-1">Reservation fee: <span className="font-semibold">{amount}</span>{reservation.pay_by ? ` · pay by ${new Date(reservation.pay_by).toLocaleString()}` : ''}</p>}
        {status === 'rejected' && reservation.payment_admin_note && <p className="text-sm text-red-700 mt-2">Your last proof was not accepted: {reservation.payment_admin_note}</p>}
      </div>

      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-gray-400">Send payment to</p>
        {numbers.length === 0 ? (
          <p className="text-sm text-gray-500 mt-2">Payment numbers will be shown here shortly. Contact Campus Crib support if you need them now.</p>
        ) : (
          <ul className="mt-2 divide-y divide-gray-100 rounded-xl border border-gray-100">
            {numbers.map((n) => (
              <li key={n.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                <span className="font-semibold text-gray-900">{n.network}</span>
                <span className="font-mono text-gray-800">{n.phone}</span>
                {n.account_name && <span className="text-gray-500 truncate">{n.account_name}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {instructions && (
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-gray-400">How to pay</p>
          <p className="text-sm text-gray-700 mt-1 whitespace-pre-line">{instructions}</p>
        </div>
      )}

      <form onSubmit={submit} className="space-y-3 border-t border-gray-100 pt-4">
        <p className="text-sm font-semibold text-gray-900">Upload your payment proof</p>
        <input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} className="block w-full text-sm" />
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Transaction reference (optional)" className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm" />
        {error && <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>}
        <button disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-accent text-white px-4 py-2.5 text-sm font-bold disabled:opacity-60"><Upload size={16}/> {busy ? 'Sending…' : 'Submit payment proof'}</button>
      </form>
    </div>
  )
}
