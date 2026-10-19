import { useState } from 'react'
import { Loader2, BadgeCheck, Clock3, AlertTriangle } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { formatSupabaseError } from '../lib/errorMessages'
import { discardPrivateUpload, uploadAgentPaymentProof } from '../lib/storage'

const money = (access) => `${access.currency} ${Number(access.amount).toLocaleString()}`
const dateText = (value) => (value ? new Date(value).toLocaleDateString() : null)

/** Shows an agent whether they can post listings, and lets them pay the access fee by uploading proof of payment. */
export default function AgentAccessCard({ access, agentId, onChanged }) {
  const [file, setFile] = useState(null)
  const [payerNote, setPayerNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (!access || access.state === 'not_required') return null

  const needsPayment = ['payment_needed', 'rejected', 'expired'].includes(access.state)

  async function submitProof(e) {
    e.preventDefault()
    setError('')
    if (!file) {
      setError('Please choose a photo or PDF of your payment confirmation.')
      return
    }
    setSubmitting(true)
    let reference = null
    try {
      reference = await uploadAgentPaymentProof(file)
      const { error: insertError } = await supabase.from('agent_payments').insert({
        agent_id: agentId,
        amount: access.amount,
        currency: access.currency,
        proof_path: reference,
        payer_note: payerNote.trim() || null,
      })
      if (insertError) throw insertError
      setFile(null)
      setPayerNote('')
      await onChanged?.()
    } catch (err) {
      if (reference) discardPrivateUpload(reference, 'agent-payment-proof').catch(() => {})
      setError(formatSupabaseError(err, 'Could not submit your proof of payment.'))
    }
    setSubmitting(false)
  }

  if (access.state === 'active' || access.state === 'waived') {
    return (
      <div className="rounded-2xl border border-accent/30 bg-accent/5 p-4 flex items-start gap-3">
        <BadgeCheck size={20} className="text-accent shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-primary">Agent access is active</p>
          <p className="text-sm text-gray-600">
            {access.state === 'waived'
              ? 'Campus Crib has waived your agent fee.'
              : access.access_until
                ? `Valid until ${dateText(access.access_until)}.`
                : 'There is no expiry date.'}
          </p>
        </div>
      </div>
    )
  }

  if (access.state === 'provisional' || access.state === 'awaiting_verification') {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
        <Clock3 size={20} className="text-amber-700 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-amber-900">Payment proof received</p>
          <p className="text-sm text-amber-800">
            {access.state === 'provisional'
              ? 'You can add listings while we check your payment. If it cannot be confirmed, your access stops.'
              : 'You can add listings once we have checked your payment.'}
          </p>
        </div>
      </div>
    )
  }

  if (access.state === 'revoked') {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 flex items-start gap-3">
        <AlertTriangle size={20} className="text-red-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-red-800">Agent access is switched off</p>
          <p className="text-sm text-red-700">Please contact Campus Crib for details.</p>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={submitProof} className="rounded-2xl border border-gray-200 bg-white p-5 space-y-3">
      <div>
        <h3 className="text-base font-semibold text-primary">Activate your agent account</h3>
        <p className="text-sm text-gray-600 mt-1">
          Pay <span className="font-semibold text-gray-900">{money(access)}</span>
          {access.access_days > 0 ? ` for ${access.access_days} days of access` : ''}, then upload your proof of payment below.
        </p>
      </div>

      {access.state === 'expired' && (
        <p className="text-sm text-amber-700">Your last access ended{access.access_until ? ` on ${dateText(access.access_until)}` : ''}. Please pay again to continue.</p>
      )}
      {access.state === 'rejected' && (
        <p className="text-sm text-red-600">Your last proof was rejected{access.last_rejection ? `: ${access.last_rejection}` : '.'} Please submit a new one.</p>
      )}

      {access.instructions && (
        <div className="rounded-xl bg-gray-50 p-3 text-sm text-gray-700 whitespace-pre-line">{access.instructions}</div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Proof of payment (photo or PDF)</label>
        <input
          type="file"
          accept="image/*,application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-2 file:text-white"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Transaction reference <span className="text-gray-400">(optional)</span></label>
        <input
          type="text"
          value={payerNote}
          onChange={(e) => setPayerNote(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          placeholder="e.g. the mobile money transaction ID"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
      >
        {submitting && <Loader2 size={15} className="animate-spin" />}
        Submit proof of payment
      </button>
    </form>
  )
}
