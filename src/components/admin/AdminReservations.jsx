import { useEffect, useMemo, useState } from 'react'
import { CalendarPlus, CheckCircle2, Clock3, UserRound, XCircle } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { formatSupabaseError } from '../../lib/errorMessages'

export default function AdminReservations() {
  const [rows, setRows] = useState([])
  const [students, setStudents] = useState([])
  const [properties, setProperties] = useState([])
  const [selectedStudent, setSelectedStudent] = useState('')
  const [selectedProperty, setSelectedProperty] = useState('')
  const [moveIn, setMoveIn] = useState('')
  const [moveOut, setMoveOut] = useState('')
  const [occupants, setOccupants] = useState(1)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    setError('')
    const [reservationRes, studentRes, propertyRes] = await Promise.all([
      supabase.from('reservations').select('id, property_id, student_id, move_in_date, move_out_date, occupants, status, student_note, admin_note, created_at, profiles:student_id(id,name,phone), properties:property_id(id,title,price,currency,landlord_id)').order('created_at', { ascending: false }),
      supabase.from('profiles').select('id,name,phone').eq('role', 'student').order('name'),
      supabase.from('properties').select('id,title,price,currency,status,landlord_id').eq('status', 'approved').order('title'),
    ])
    if (reservationRes.error) setError(formatSupabaseError(reservationRes.error, 'Could not load reservations.'))
    setRows(reservationRes.data || [])
    setStudents(studentRes.data || [])
    setProperties(propertyRes.data || [])
  }

  useEffect(() => { load() }, [])

  const pending = useMemo(() => rows.filter(r => r.status === 'pending'), [rows])

  async function confirm(id) {
    setBusy(true); setError('')
    const note = window.prompt('Optional note for the student:') || null
    const { error: rpcError } = await supabase.rpc('admin_confirm_reservation', { p_reservation_id: id, p_admin_note: note })
    if (rpcError) setError(formatSupabaseError(rpcError, 'Could not confirm the reservation.'))
    await load(); setBusy(false)
  }

  async function reject(id) {
    setBusy(true); setError('')
    const note = window.prompt('Why is this reservation not being approved?') || null
    const { error: rpcError } = await supabase.rpc('admin_reject_reservation', { p_reservation_id: id, p_admin_note: note })
    if (rpcError) setError(formatSupabaseError(rpcError, 'Could not reject the reservation.'))
    await load(); setBusy(false)
  }

  async function createForStudent(e) {
    e.preventDefault(); setBusy(true); setError('')
    const { error: rpcError } = await supabase.rpc('admin_create_reservation', {
      p_property_id: selectedProperty,
      p_student_id: selectedStudent,
      p_move_in_date: moveIn,
      p_move_out_date: moveOut || null,
      p_occupants: Number(occupants),
      p_admin_note: note || null,
    })
    if (rpcError) setError(formatSupabaseError(rpcError, 'Could not create the reservation.'))
    else {
      setSelectedStudent(''); setSelectedProperty(''); setMoveIn(''); setMoveOut(''); setOccupants(1); setNote('')
    }
    await load(); setBusy(false)
  }

  return (
    <div className="space-y-6">
      <div><h2 className="text-lg font-semibold text-primary">Reservations</h2><p className="text-sm text-gray-500">Manage student room requests and reserve a room on a student's behalf.</p></div>
      {error && <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>}

      <form onSubmit={createForStudent} className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2"><CalendarPlus size={19} className="text-accent"/><h3 className="font-bold text-primary">Reserve for a student</h3></div>
        <p className="text-xs text-gray-500">Use this when a student contacts you directly by phone, WhatsApp, chat or in person and asks you to hold a specific room.</p>
        <div className="grid md:grid-cols-2 gap-3">
          <label className="text-sm font-medium text-gray-700">Student<select required value={selectedStudent} onChange={e => setSelectedStudent(e.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 bg-white"><option value="">Select student…</option>{students.map(s => <option key={s.id} value={s.id}>{s.name}{s.phone ? ` · ${s.phone}` : ''}</option>)}</select></label>
          <label className="text-sm font-medium text-gray-700">Room / listing<select required value={selectedProperty} onChange={e => setSelectedProperty(e.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 bg-white"><option value="">Select listing…</option>{properties.map(p => <option key={p.id} value={p.id}>{p.title} · {p.currency} {Number(p.price).toLocaleString()}</option>)}</select></label>
          <label className="text-sm font-medium text-gray-700">Move-in date<input required type="date" value={moveIn} min={new Date().toISOString().slice(0,10)} onChange={e => setMoveIn(e.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5" /></label>
          <label className="text-sm font-medium text-gray-700">Move-out date (optional)<input type="date" value={moveOut} min={moveIn || new Date().toISOString().slice(0,10)} onChange={e => setMoveOut(e.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5" /></label>
          <label className="text-sm font-medium text-gray-700">Occupants<input required min="1" type="number" value={occupants} onChange={e => setOccupants(e.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5" /></label>
          <label className="text-sm font-medium text-gray-700">Admin note<input value={note} onChange={e => setNote(e.target.value)} placeholder="Optional" className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5" /></label>
        </div>
        <button disabled={busy} className="rounded-xl bg-primary text-white px-4 py-2.5 text-sm font-bold disabled:opacity-60">{busy ? 'Saving…' : 'Confirm reservation'}</button>
      </form>

      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-gray-100"><h3 className="font-bold text-primary">Pending requests {pending.length ? `(${pending.length})` : ''}</h3></div>
        {pending.length === 0 ? <div className="p-6 text-sm text-gray-500">No pending reservation requests.</div> : <div className="divide-y divide-gray-100">{pending.map(r => <div key={r.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4"><div><p className="font-semibold text-gray-900">{r.profiles?.name || 'Student'} → {r.properties?.title || 'Listing'}</p><p className="text-sm text-gray-500 mt-1">Move-in {r.move_in_date}{r.move_out_date ? ` · Move-out ${r.move_out_date}` : ''} · {r.occupants} occupant{r.occupants === 1 ? '' : 's'}</p>{r.profiles?.phone && <p className="text-xs text-gray-500 mt-1">Student phone: {r.profiles.phone}</p>}{r.student_note && <p className="text-sm text-gray-600 mt-2">“{r.student_note}”</p>}</div><div className="flex gap-2 shrink-0"><button disabled={busy} onClick={() => confirm(r.id)} className="inline-flex items-center gap-1 rounded-xl bg-accent text-white px-3 py-2 text-sm font-semibold"><CheckCircle2 size={15}/> Confirm</button><button disabled={busy} onClick={() => reject(r.id)} className="inline-flex items-center gap-1 rounded-xl border border-red-200 text-red-700 px-3 py-2 text-sm font-semibold"><XCircle size={15}/> Reject</button></div></div>)}</div>}
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-gray-100"><h3 className="font-bold text-primary">Reservation history</h3></div>
        <div className="divide-y divide-gray-100">{rows.slice(0, 20).map(r => <div key={r.id} className="p-4 flex items-center justify-between gap-3"><div><p className="text-sm font-semibold">{r.profiles?.name || 'Student'} · {r.properties?.title || 'Listing'}</p><p className="text-xs text-gray-500 mt-1">{r.move_in_date} · {r.status}</p></div><span className="text-xs text-gray-500"><UserRound size={13} className="inline mr-1"/>{r.profiles?.phone || 'No phone'}</span></div>)}{rows.length === 0 && <div className="p-6 text-sm text-gray-500">No reservations yet.</div>}</div>
      </div>
    </div>
  )
}
