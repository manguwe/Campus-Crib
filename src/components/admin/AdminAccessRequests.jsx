import { useEffect, useState } from 'react'
import { Check, Eye, X } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { formatSupabaseError } from '../../lib/errorMessages'
import ErrorBanner from '../ui/ErrorBanner'

export default function AdminAccessRequests() {
  const [rows, setRows] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [busy, setBusy] = useState(null)
  async function load() {
    setLoading(true); setError('')
    const { data, error } = await supabase.from('property_access_requests').select('id, property_id, student_id, amount, currency, proof_path, status, review_note, submitted_at').order('submitted_at', { ascending: false })
    if (error) { setError(formatSupabaseError(error, 'Could not load access requests.')); setLoading(false); return }
    const ids = [...new Set((data || []).map(r => r.student_id))]
    const pids = [...new Set((data || []).map(r => r.property_id))]
    const [{ data: profiles }, { data: properties }] = await Promise.all([
      ids.length ? supabase.from('profiles').select('id,name,phone').in('id', ids) : Promise.resolve({ data: [] }),
      pids.length ? supabase.from('properties').select('id,title').in('id', pids) : Promise.resolve({ data: [] }),
    ])
    const names = Object.fromEntries((profiles || []).map(p => [p.id, p])); const titles = Object.fromEntries((properties || []).map(p => [p.id, p.title]))
    setRows((data || []).map(r => ({ ...r, student: names[r.student_id], title: titles[r.property_id] }))); setLoading(false)
  }
  useEffect(() => { load() }, [])
  async function proofUrl(path) { const { data, error } = await supabase.storage.from('payment-proofs').createSignedUrl(path, 600); if (error) { setError(formatSupabaseError(error, 'Could not open the proof.')); return }; window.open(data.signedUrl, '_blank', 'noopener,noreferrer') }
  async function review(id, decision) { const note = decision === 'rejected' ? (window.prompt('Reason for rejecting this proof (optional):') || '') : ''; setBusy(id); const { error } = await supabase.rpc('review_property_access_request', { p_request_id: id, p_decision: decision, p_note: note }); setBusy(null); if (error) { setError(formatSupabaseError(error, 'Could not review the request.')); return }; await load() }
  if (loading) return <div className="p-6 text-sm text-gray-500">Loading payment requests…</div>
  return <div className="space-y-4">{error && <ErrorBanner message={error}/>} {rows.length === 0 ? <div className="rounded-2xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-500">No payment access requests yet.</div> : rows.map(r => <div key={r.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-bold text-primary">{r.title || 'Listing'}</p><p className="text-sm text-gray-600">{r.student?.name || 'Student'} · {r.currency} {Number(r.amount).toLocaleString()}</p><p className="text-xs text-gray-400 mt-1">{new Date(r.submitted_at).toLocaleString()}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${r.status === 'approved' ? 'bg-green-50 text-green-700' : r.status === 'rejected' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>{r.status}</span></div><div className="mt-3 flex flex-wrap gap-2">{r.proof_path && <button onClick={() => proofUrl(r.proof_path)} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold"><Eye size={15}/> View proof</button>}{r.status === 'pending' && <><button disabled={busy===r.id} onClick={() => review(r.id,'approved')} className="inline-flex items-center gap-2 rounded-xl bg-accent px-3 py-2 text-sm font-bold text-white disabled:opacity-50"><Check size={15}/> Approve & unlock</button><button disabled={busy===r.id} onClick={() => review(r.id,'rejected')} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-50"><X size={15}/> Reject</button></>}</div></div>)}</div>
}
