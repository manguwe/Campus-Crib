import { useEffect, useState } from 'react'
import { CheckCircle2, LockKeyhole, MapPin, Phone, Upload, Clock3, ShieldCheck, ExternalLink, MessageCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { formatSupabaseError } from '../lib/errorMessages'
import GoogleMapPin from './GoogleMapPin'

export default function PropertyAccessPanel({ property }) {
  const { user, role } = useAuth()
  const [fee, setFee] = useState(Number(property.agent_fee_amount || 0))
  const [feeCurrency, setFeeCurrency] = useState(property.agent_fee_currency || 'ZMW')
  const [request, setRequest] = useState(null)
  const [privateAccess, setPrivateAccess] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [proof, setProof] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  async function load() {
    if (!property?.id) return
    setLoading(true); setError('')
    const [{ data: feeRows }, { data: requests, error: reqError }] = await Promise.all([
      supabase.rpc('get_property_agent_fee', { p_property_id: property.id }),
      user?.id ? supabase.from('property_access_requests').select('id, amount, currency, proof_path, status, review_note, submitted_at, reviewed_at').eq('property_id', property.id).eq('student_id', user.id).order('submitted_at', { ascending: false }).limit(1) : Promise.resolve({ data: [], error: null }),
    ])
    if (feeRows?.[0]) { setFee(Number(feeRows[0].agent_fee_amount || 0)); setFeeCurrency(feeRows[0].agent_fee_currency || 'ZMW') }
    if (reqError) setError(formatSupabaseError(reqError, 'Could not load access status.'))
    setRequest(requests?.[0] || null)
    if (user?.id && role === 'student') {
      const { data: accessRows, error: accessError } = await supabase.rpc('get_private_property_access', { p_property_id: property.id })
      if (!accessError && accessRows?.[0]) setPrivateAccess(accessRows[0])
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [property?.id, user?.id, role])

  async function submitProof(e) {
    e.preventDefault(); setError('')
    if (!proof) return setError('Choose your payment proof first.')
    setSubmitting(true)
    const ext = proof.name.split('.').pop()?.toLowerCase() || 'file'
    const path = `${user.id}/${property.id}/${Date.now()}.${ext}`
    const { error: uploadError } = await supabase.storage.from('payment-proofs').upload(path, proof, { upsert: false })
    if (uploadError) { setSubmitting(false); setError(formatSupabaseError(uploadError, 'Could not upload your payment proof.')); return }
    const { data: requestId, error: requestError } = await supabase.rpc('create_property_access_request', { p_property_id: property.id, p_proof_path: path })
    if (requestError) { await supabase.storage.from('payment-proofs').remove([path]); setSubmitting(false); setError(formatSupabaseError(requestError, 'Could not submit the payment request.')); return }
    setRequest({ id: requestId, amount: fee, currency: feeCurrency, proof_path: path, status: 'pending', submitted_at: new Date().toISOString() })
    setProof(null); setSubmitting(false)
  }

  if (role === 'landlord' || role === 'admin') return null

  const feeLabel = `${feeCurrency} ${fee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  if (privateAccess) {
    let contacts = []
    try { contacts = typeof privateAccess.contacts === 'string' ? JSON.parse(privateAccess.contacts) : (privateAccess.contacts || []) } catch {}
    return (
      <div className="mt-4 rounded-2xl border border-accent/20 bg-accent/5 p-4 animate-fade-in-up">
        <div className="flex items-center gap-2 text-accent font-bold"><CheckCircle2 size={18} /> Contact access approved</div>
        <p className="text-xs text-gray-600 mt-1">This listing's private contact and exact location are now unlocked for your account.</p>
        <div className="mt-3 grid gap-2 text-sm">
          {privateAccess.landlord_phone && <a className="inline-flex items-center gap-2 font-semibold text-primary" href={`tel:${privateAccess.landlord_phone}`}><Phone size={15}/> {privateAccess.landlord_phone}</a>}
          <div className="text-gray-700"><MapPin size={15} className="inline mr-1"/> Exact coordinates: {privateAccess.latitude?.toFixed(6)}, {privateAccess.longitude?.toFixed(6)}</div><div className="mt-3 rounded-xl overflow-hidden border border-gray-200"><GoogleMapPin latitude={privateAccess.latitude} longitude={privateAccess.longitude} title={property.title} /></div>
          {contacts.map((c) => <a key={c.id} className="inline-flex items-center gap-2 text-gray-700" href={c.contact_type === 'whatsapp' ? `https://wa.me/${c.phone_number.replace(/\D/g,'')}` : `tel:${c.phone_number}`} target={c.contact_type === 'whatsapp' ? '_blank' : undefined} rel="noreferrer"><Phone size={14}/> {c.phone_number} · {c.label || c.contact_type}</a>)}
          <a className="inline-flex items-center gap-2 text-accent font-medium" target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${privateAccess.latitude},${privateAccess.longitude}`}><ExternalLink size={14}/> Open exact location in Maps</a>
          <Link to={`/messages?property=${property.id}`} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-white px-4 py-2.5 font-bold mt-2"><MessageCircle size={15}/> Chat about this listing</Link>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-center gap-2 font-bold text-primary"><LockKeyhole size={17}/> Contact details are protected</div>
        <p className="text-sm text-gray-600 mt-1">Agent fee: <strong>{feeLabel}</strong>. Log in as a student to request access.</p>
        <Link to="/login" className="inline-flex mt-3 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white">Log in</Link>
      </div>
    )
  }

  if (role !== 'student') return null

  if (fee <= 0) {
    return <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700"><ShieldCheck className="inline mr-2 text-accent" size={17}/>This listing has no agent fee. Contact access is being prepared by the administrator.</div>
  }

  return (
    <div className="mt-4 rounded-2xl border border-primary/10 bg-white shadow-sm p-4">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-primary/5 p-2.5 text-primary"><LockKeyhole size={20}/></div>
        <div className="flex-1"><h3 className="font-bold text-primary">Unlock landlord contact & exact location</h3><p className="text-sm text-gray-600 mt-1">Agent fee: <strong>{feeLabel}</strong>. The general area remains visible; phone and exact coordinates are released only after admin approval.</p></div>
      </div>
      {request?.status === 'pending' ? (
        <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800"><Clock3 size={16} className="inline mr-1"/> Payment proof submitted. Waiting for admin verification.</div>
      ) : request?.status === 'rejected' ? (
        <div className="mt-4 space-y-3"><div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">Payment proof was not approved{request.review_note ? `: ${request.review_note}` : '.'}</div><PaymentForm proof={proof} setProof={setProof} onSubmit={submitProof} submitting={submitting} /></div>
      ) : (
        <PaymentForm proof={proof} setProof={setProof} onSubmit={submitProof} submitting={submitting} />
      )}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  )
}

function PaymentForm({ proof, setProof, onSubmit, submitting }) {
  return <form onSubmit={onSubmit} className="mt-4 space-y-3"><label className="block text-sm font-semibold text-gray-700">Upload proof of payment</label><input type="file" accept="image/*,.pdf" required={!proof} onChange={(e) => setProof(e.target.files?.[0] || null)} className="block w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm"/><p className="text-xs text-gray-500">Accepted: image or PDF. Make sure the transaction reference and amount are readable.</p><button disabled={submitting} className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"><Upload size={16}/>{submitting ? 'Submitting…' : 'Submit payment proof'}</button></form>
}
