import { useEffect, useState } from 'react'
import { CalendarDays, CheckCircle2, Clock3, XCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { cancelReservation, fetchReservationEvents, fetchReservationPaymentSettings, refreshStaleReservations, respondToReservation, submitReservationPayment, RESERVATION_EVENT_LABELS } from '../lib/reservations'
import { discardPrivateUpload, uploadReservationProof } from '../lib/storage'
import { formatSupabaseError } from '../lib/errorMessages'

const labels = { pending: 'Pending review', confirmed: 'Confirmed', rejected: 'Not approved', cancelled: 'Cancelled', expired: 'Expired' }

export default function Reservations() {
  const { user, role } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [events, setEvents] = useState({})
  const [openTimeline, setOpenTimeline] = useState(null)
  const [paySettings, setPaySettings] = useState(null)
  const [payFiles, setPayFiles] = useState({})
  const [payNotes, setPayNotes] = useState({})
  const [payBusy, setPayBusy] = useState(null)
  const [receiptId, setReceiptId] = useState(null)

  async function load() {
    setLoading(true); setError('')
    await refreshStaleReservations()
    fetchReservationPaymentSettings().then(setPaySettings)
    // Do not embed properties here. The schema contains two relationships
    // between reservations and properties (reservations.property_id and
    // properties.reservation_hold_id), so PostgREST cannot safely infer which
    // relationship `properties(...)` refers to. Load the two resources
    // separately and join them in the client instead.
    let reservationQuery = supabase
      .from('reservations')
      .select('id, property_id, student_id, move_in_date, move_out_date, occupants, status, student_note, admin_note, created_at, reference_code, respond_by, owner_response, owner_note, payment_status, fee_amount, fee_currency, pay_by, payment_admin_note')
      .order('created_at', { ascending: false })

    if (role === 'student') reservationQuery = reservationQuery.eq('student_id', user.id)

    const { data: reservationData, error: reservationError } = await reservationQuery
    if (reservationError) {
      setError(formatSupabaseError(reservationError, 'Could not load reservations.'))
      setRows([])
      setLoading(false)
      return
    }

    const reservations = reservationData || []
    const propertyIds = [...new Set(reservations.map(r => r.property_id).filter(Boolean))]

    if (!propertyIds.length) {
      setRows([])
      setLoading(false)
      return
    }

    let propertyQuery = supabase
      .from('properties')
      .select('id, title, price, currency, landlord_id')
      .in('id', propertyIds)

    if (role === 'landlord') propertyQuery = propertyQuery.eq('landlord_id', user.id)

    const { data: propertyData, error: propertyError } = await propertyQuery
    if (propertyError) {
      setError(formatSupabaseError(propertyError, 'Could not load reservation listings.'))
      setRows([])
      setLoading(false)
      return
    }

    const propertyMap = Object.fromEntries((propertyData || []).map(p => [p.id, p]))
    const joined = reservations
      .filter(r => role !== 'landlord' || propertyMap[r.property_id])
      .map(r => ({ ...r, properties: propertyMap[r.property_id] || null }))

    setRows(joined)
    setLoading(false)
  }

  useEffect(() => { if (user) load() }, [user?.id, role])

  async function cancel(id) {
    if (!window.confirm('Cancel this reservation request?')) return
    try { await cancelReservation(id); await load() } catch (err) { setError(formatSupabaseError(err, 'Could not cancel reservation.')) }
  }

  async function respond(reservation, accept) {
    const note = window.prompt(accept ? 'Optional note for the student:' : 'Optional reason for declining:') || null
    setError('')
    try { await respondToReservation({ id: reservation.id, accept, note }); await load() } catch (err) { setError(formatSupabaseError(err, 'Could not send your response.')) }
  }

  function pendingText(r) {
    if (r.owner_response === 'accepted') {
      if (r.payment_status === 'awaiting_payment' || r.payment_status === 'rejected') {
        return role === 'landlord' ? 'You accepted. Waiting for the student to pay the reservation fee.' : 'The owner accepted. Pay the reservation fee below to secure the room.'
      }
      if (r.payment_status === 'proof_submitted') return 'Payment proof received. Waiting for Campus Crib to check it.'
      return 'The owner accepted. Waiting for Campus Crib to confirm.'
    }
    return r.respond_by ? `Waiting for the owner to respond by ${new Date(r.respond_by).toLocaleString()}.` : 'Waiting for the owner to respond.'
  }

  async function sendPayment(reservation) {
    const file = payFiles[reservation.id]
    if (!file) { setError('Please choose a photo or PDF of your payment confirmation.'); return }
    setError(''); setPayBusy(reservation.id)
    let reference = null
    try {
      reference = await uploadReservationProof(file)
      await submitReservationPayment({ id: reservation.id, proofPath: reference, note: payNotes[reservation.id] })
      setPayFiles(prev => ({ ...prev, [reservation.id]: null }))
      await load()
    } catch (err) {
      if (reference) discardPrivateUpload(reference, 'reservation-proof').catch(() => {})
      setError(formatSupabaseError(err, 'Could not send your proof of payment.'))
    }
    setPayBusy(null)
  }

  async function toggleTimeline(id) {
    if (openTimeline === id) { setOpenTimeline(null); return }
    setOpenTimeline(id)
    if (!events[id]) {
      try { const list = await fetchReservationEvents(id); setEvents(prev => ({ ...prev, [id]: list })) } catch { setEvents(prev => ({ ...prev, [id]: [] })) }
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div><p className="text-xs font-bold tracking-[0.22em] text-accent uppercase">Campus Crib reservations</p><h1 className="text-2xl font-bold text-primary mt-2">{role === 'landlord' ? 'Reservations on your listings' : 'My room requests'}</h1><p className="text-gray-600 mt-1">{role === 'landlord' ? 'See which students have requested or secured your rooms.' : 'Track rooms you have asked Campus Crib to reserve.'}</p></div>
      {error && <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>}
      {loading ? <div className="text-sm text-gray-500">Loading reservations…</div> : rows.length === 0 ? <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center text-gray-500">{role === 'landlord' ? 'No reservation requests for your listings yet.' : "You don't have any reservation requests yet."}<div className="mt-3"><Link to={role === 'landlord' ? '/landlord' : '/browse'} className="inline-flex rounded-xl bg-primary text-white px-4 py-2 text-sm font-bold">{role === 'landlord' ? 'Back to dashboard' : 'Browse rooms'}</Link></div></div> : <div className="space-y-3">{rows.map(r => <div key={r.id} className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><Link to={`/properties/${r.property_id}`} className="font-bold text-primary hover:underline">{r.properties?.title || 'Listing'}</Link><p className="text-sm text-gray-600 mt-1">{r.properties?.currency} {Number(r.properties?.price || 0).toLocaleString()} / month</p></div><span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold">{labels[r.status] || r.status}</span></div><div className="grid grid-cols-2 gap-3 mt-4 text-sm"><div><span className="text-gray-500">Move-in</span><p className="font-semibold">{r.move_in_date}</p></div><div><span className="text-gray-500">Move-out</span><p className="font-semibold">{r.move_out_date || 'Not set'}</p></div></div>{r.student_note && <p className="mt-3 text-sm text-gray-600">{r.student_note}</p>}{r.reference_code && <p className="mt-3 text-xs text-gray-500">Reference: <span className="font-mono font-semibold text-gray-800">{r.reference_code}</span></p>}{r.status === 'pending' && <p className="mt-2 text-sm text-gray-600">{pendingText(r)}</p>}{role !== 'landlord' && r.status === 'pending' && ['awaiting_payment', 'rejected'].includes(r.payment_status) && <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3"><p className="text-sm font-semibold text-amber-900">Pay {r.fee_currency} {Number(r.fee_amount || 0).toLocaleString()} by {r.pay_by ? new Date(r.pay_by).toLocaleString() : 'the deadline'}</p>{r.payment_status === 'rejected' && r.payment_admin_note && <p className="text-sm text-red-700">Your last proof was rejected: {r.payment_admin_note}</p>}{paySettings?.instructions && <p className="text-sm text-amber-900 whitespace-pre-line">{paySettings.instructions}</p>}{paySettings?.refund_policy && <p className="text-xs text-amber-800 whitespace-pre-line">{paySettings.refund_policy}</p>}<input type="file" accept="image/*,application/pdf" onChange={e => setPayFiles(prev => ({ ...prev, [r.id]: e.target.files?.[0] || null }))} className="block w-full text-sm text-gray-600" /><input type="text" value={payNotes[r.id] || ''} onChange={e => setPayNotes(prev => ({ ...prev, [r.id]: e.target.value }))} placeholder="Transaction reference (optional)" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /><button disabled={payBusy === r.id} onClick={() => sendPayment(r)} className="rounded-xl bg-primary text-white px-4 py-2 text-sm font-bold disabled:opacity-50">{payBusy === r.id ? 'Sending…' : 'Send proof of payment'}</button></div>}{r.owner_note && <p className="mt-3 rounded-xl bg-gray-50 p-3 text-sm text-gray-700">Owner note: {r.owner_note}</p>}{r.admin_note && <p className="mt-3 rounded-xl bg-blue-50 p-3 text-sm text-blue-800">Admin note: {r.admin_note}</p>}{role === 'landlord' && r.status === 'pending' && !r.owner_response && <div className="mt-3 flex gap-2"><button onClick={() => respond(r, true)} className="rounded-xl bg-accent text-white px-4 py-2 text-sm font-bold">Accept</button><button onClick={() => respond(r, false)} className="rounded-xl border border-red-200 text-red-700 px-4 py-2 text-sm font-bold">Decline</button></div>}<div className="mt-3 flex flex-wrap items-center gap-4">{['pending','confirmed'].includes(r.status) && <button onClick={() => cancel(r.id)} className="text-sm font-semibold text-red-600 hover:underline">Cancel request</button>}<button onClick={() => toggleTimeline(r.id)} className="text-sm font-semibold text-gray-600 hover:underline">{openTimeline === r.id ? 'Hide timeline' : 'View timeline'}</button>{r.status === 'confirmed' && <button onClick={() => setReceiptId(receiptId === r.id ? null : r.id)} className="text-sm font-semibold text-primary hover:underline">{receiptId === r.id ? 'Hide receipt' : 'View receipt'}</button>}</div>{receiptId === r.id && <div className="mt-3 rounded-xl border-2 border-dashed border-gray-300 p-4 text-sm space-y-1 bg-white"><p className="font-bold text-primary">Campus Crib reservation receipt</p><p>Reference: <span className="font-mono font-semibold">{r.reference_code}</span></p><p>Listing: {r.properties?.title || 'Listing'}</p><p>Move-in: {r.move_in_date}{r.move_out_date ? ` · Move-out: ${r.move_out_date}` : ''} · {r.occupants} occupant{r.occupants === 1 ? '' : 's'}</p><p>Monthly rent: {r.properties?.currency} {Number(r.properties?.price || 0).toLocaleString()}</p><p>Reservation fee: {r.payment_status === 'verified' ? `${r.fee_currency} ${Number(r.fee_amount || 0).toLocaleString()} (verified)` : 'None required'}</p><p className="text-xs text-gray-500">Status: Confirmed. Keep this reference and quote it to the owner or agent.</p><button onClick={() => window.print()} className="mt-2 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700">Print or save as PDF</button></div>}{openTimeline === r.id && <ol className="mt-3 space-y-2 border-l-2 border-gray-200 pl-4">{(events[r.id] || []).length === 0 ? <li className="text-sm text-gray-500">No activity recorded yet.</li> : (events[r.id] || []).map(ev => <li key={ev.id} className="text-sm"><p className="font-medium text-gray-800">{RESERVATION_EVENT_LABELS[ev.event] || ev.event}</p><p className="text-xs text-gray-500">{new Date(ev.created_at).toLocaleString()}{ev.note ? ` · ${ev.note}` : ''}</p></li>)}</ol>}</div>)}</div>}
    </div>
  )
}
