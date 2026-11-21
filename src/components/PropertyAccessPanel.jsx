import { useEffect, useState } from 'react'
import { CheckCircle2, LockKeyhole, MapPin, Phone, Upload, Clock3, ShieldCheck, MessageCircle, Smartphone } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { formatSupabaseError } from '../lib/errorMessages'
import { uploadPaymentProof, discardPrivateUpload } from '../lib/storage'
import { fetchReservationPaymentNumbers } from '../lib/roomAccess'

export default function PropertyAccessPanel({ property }) {
  const { user, role } = useAuth()
  const [fee, setFee] = useState(Number(property.agent_fee_amount || 0))
  const [feeCurrency, setFeeCurrency] = useState(property.agent_fee_currency || 'ZMW')
  const [request, setRequest] = useState(null)
  const [privateAccess, setPrivateAccess] = useState(null)
  const [paymentNumbers, setPaymentNumbers] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [proof, setProof] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  async function load() {
    if (!property?.id) return
    setLoading(true)
    setError('')
    const [{ data: feeRows }, { data: requests, error: reqError }] = await Promise.all([
      supabase.rpc('get_property_agent_fee', { p_property_id: property.id }),
      user?.id
        ? supabase
            .from('property_access_requests')
            .select('id, amount, currency, proof_path, status, review_note, submitted_at, reviewed_at')
            .eq('property_id', property.id)
            .eq('student_id', user.id)
            .order('submitted_at', { ascending: false })
            .limit(1)
        : Promise.resolve({ data: [], error: null }),
    ])

    if (feeRows?.[0]) {
      setFee(Number(feeRows[0].agent_fee_amount || 0))
      setFeeCurrency(feeRows[0].agent_fee_currency || 'ZMW')
    }
    if (reqError) setError(formatSupabaseError(reqError, 'Could not load access status.'))
    setRequest(requests?.[0] || null)
    setPrivateAccess(null)

    if (user?.id && role === 'student') {
      const [accessResult, numbersResult] = await Promise.all([
        supabase.rpc('get_private_property_access', { p_property_id: property.id }),
        fetchReservationPaymentNumbers().catch((loadError) => {
          setError(formatSupabaseError(loadError, 'Could not load the payment numbers.'))
          return []
        }),
      ])
      if (!accessResult.error && accessResult.data?.[0]) setPrivateAccess(accessResult.data[0])
      setPaymentNumbers(numbersResult)
    } else {
      setPaymentNumbers([])
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [property?.id, user?.id, role])

  async function submitProof(e) {
    e.preventDefault()
    setError('')
    if (!proof) return setError('Choose your payment proof first.')
    setSubmitting(true)
    let path
    try {
      path = await uploadPaymentProof(proof, property.id)
    } catch (uploadError) {
      setSubmitting(false)
      setError(formatSupabaseError(uploadError, 'Could not upload your payment proof.'))
      return
    }
    const { data: requestId, error: requestError } = await supabase.rpc('create_property_access_request', {
      p_property_id: property.id,
      p_proof_path: path,
    })
    if (requestError) {
      try { await discardPrivateUpload(path, 'payment-proof') } catch {}
      setSubmitting(false)
      setError(formatSupabaseError(requestError, 'Could not submit the payment request.'))
      return
    }
    setRequest({
      id: requestId,
      amount: fee,
      currency: feeCurrency,
      proof_path: path,
      status: 'pending',
      submitted_at: new Date().toISOString(),
    })
    setProof(null)
    setSubmitting(false)
  }

  if (role === 'landlord' || role === 'admin') return null

  const feeLabel = `${feeCurrency} ${fee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  if (privateAccess) {
    let contacts = []
    try {
      contacts = typeof privateAccess.contacts === 'string'
        ? JSON.parse(privateAccess.contacts)
        : (privateAccess.contacts || [])
    } catch {}
    return (
      <div className="mt-4 rounded-2xl border border-accent/20 bg-accent/5 p-4 animate-fade-in-up">
        <div className="flex items-center gap-2 text-accent font-bold"><CheckCircle2 size={18} /> Contact access approved</div>
        <p className="text-xs text-gray-600 mt-1">This room's private contact and exact location are now unlocked for your account.</p>
        <div className="mt-3 grid gap-2 text-sm">
          {privateAccess.landlord_phone && (
            <a className="inline-flex items-center gap-2 font-semibold text-primary" href={`tel:${privateAccess.landlord_phone}`}>
              <Phone size={15} /> {privateAccess.landlord_phone}
            </a>
          )}
          {privateAccess.latitude != null && privateAccess.longitude != null && (
            <div className="text-gray-700"><MapPin size={15} className="inline mr-1" /> Exact coordinates: {privateAccess.latitude.toFixed(6)}, {privateAccess.longitude.toFixed(6)}</div>
          )}
          {contacts.map((contact) => (
            <a
              key={contact.id}
              className="inline-flex items-center gap-2 text-gray-700"
              href={contact.contact_type === 'whatsapp'
                ? `https://wa.me/${String(contact.phone_number || '').replace(/\D/g, '')}`
                : `tel:${contact.phone_number}`}
              target={contact.contact_type === 'whatsapp' ? '_blank' : undefined}
              rel={contact.contact_type === 'whatsapp' ? 'noreferrer' : undefined}
            >
              <Phone size={15} /> {contact.label ? `${contact.label}: ` : ''}{contact.phone_number}
            </a>
          ))}
          {privateAccess.latitude != null && privateAccess.longitude != null && (
            <a
              className="inline-flex items-center gap-2 text-accent font-medium"
              target="_blank"
              rel="noreferrer"
              href={`https://www.google.com/maps/dir/?api=1&destination=${privateAccess.latitude},${privateAccess.longitude}`}
            >
              <MapPin size={15} /> Get directions
            </a>
          )}
          <Link to={`/messages?property=${property.id}`} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-white px-4 py-2.5 font-bold mt-2">
            <MessageCircle size={16} /> Message about this room
          </Link>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-center gap-2 font-bold text-primary"><LockKeyhole size={17} /> Contact details are protected</div>
        <p className="text-sm text-gray-600 mt-1">Agent fee: <strong>{feeLabel}</strong>. Log in as a student to request access.</p>
        <Link to="/login" className="inline-flex mt-3 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white">Log in</Link>
      </div>
    )
  }

  if (role !== 'student') return null

  if (fee <= 0) {
    return <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700"><ShieldCheck className="inline mr-2 text-accent" size={17} />This room has no agent fee. Contact the landlord through Campus Crib.</div>
  }

  return (
    <div className="mt-4 rounded-2xl border border-primary/10 bg-white shadow-sm p-4">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-primary/5 p-2.5 text-primary"><LockKeyhole size={20} /></div>
        <div className="flex-1">
          <h3 className="font-bold text-primary">Unlock landlord contact & exact location</h3>
          <p className="text-sm text-gray-600 mt-1">Agent fee: <strong>{feeLabel}</strong>. The general area remains visible; phone and exact coordinates are released only after admin approval.</p>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 p-3">
        <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-gray-500"><Smartphone size={14} /> Pay agent fee to</p>
        {loading ? (
          <p className="mt-2 text-sm text-gray-500">Loading payment numbers…</p>
        ) : paymentNumbers.length > 0 ? (
          <ul className="mt-2 divide-y divide-gray-200">
            {paymentNumbers.map((number) => (
              <li key={number.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-2 text-sm first:pt-0 last:pb-0">
                <span className="font-semibold text-gray-900">{number.network}</span>
                <span className="font-mono font-semibold text-gray-800">{number.phone}</span>
                {number.account_name && <span className="w-full text-xs text-gray-500">Account name: {number.account_name}</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-amber-800">No active agent-fee payment numbers were found. Please contact Campus Crib support before paying; do not send money to an unconfirmed number.</p>
        )}
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-gray-500">Checking your access status…</p>
      ) : request?.status === 'pending' ? (
        <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800"><Clock3 size={16} className="inline mr-1" /> Payment proof submitted. Waiting for admin verification.</div>
      ) : request?.status === 'rejected' ? (
        <div className="mt-4 space-y-3">
          <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">Payment proof was not approved{request.review_note ? `: ${request.review_note}` : '.'} Please submit a new proof.</div>
          <PaymentForm proof={proof} setProof={setProof} onSubmit={submitProof} submitting={submitting} disabled={paymentNumbers.length === 0} />
        </div>
      ) : (
        <PaymentForm proof={proof} setProof={setProof} onSubmit={submitProof} submitting={submitting} disabled={paymentNumbers.length === 0} />
      )}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  )
}

function PaymentForm({ proof, setProof, onSubmit, submitting, disabled = false }) {
  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-3">
      <label className="block text-sm font-semibold text-gray-700">Upload proof of payment</label>
      <input type="file" accept="image/*,.pdf" onChange={(event) => setProof(event.target.files?.[0] || null)} className="block w-full text-sm" />
      <button disabled={submitting || disabled} className="inline-flex items-center gap-2 rounded-xl bg-accent text-white px-4 py-2.5 text-sm font-bold disabled:opacity-60">
        <Upload size={16} /> {submitting ? 'Submitting…' : 'Submit payment proof'}
      </button>
    </form>
  )
}
