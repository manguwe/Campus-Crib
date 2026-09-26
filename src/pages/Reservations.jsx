import { useEffect, useState } from 'react'
import { CalendarDays, CheckCircle2, Clock3, XCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { cancelReservation } from '../lib/reservations'
import { formatSupabaseError } from '../lib/errorMessages'

const labels = { pending: 'Pending review', confirmed: 'Confirmed', rejected: 'Not approved', cancelled: 'Cancelled', expired: 'Expired' }

export default function Reservations() {
  const { user, role } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true); setError('')
    let query = supabase.from('reservations').select('id, property_id, student_id, move_in_date, move_out_date, occupants, status, student_note, admin_note, created_at, properties(title, price, currency, landlord_id)').order('created_at', { ascending: false })
    if (role === 'student') query = query.eq('student_id', user.id)
    if (role === 'landlord') query = supabase.from('reservations').select('id, property_id, student_id, move_in_date, move_out_date, occupants, status, student_note, admin_note, created_at, properties!inner(title, price, currency, landlord_id)').eq('properties.landlord_id', user.id).order('created_at', { ascending: false })
    const { data, error: queryError } = await query
    if (queryError) setError(formatSupabaseError(queryError, 'Could not load reservations.'))
    setRows(data || []); setLoading(false)
  }

  useEffect(() => { if (user) load() }, [user?.id, role])

  async function cancel(id) {
    if (!window.confirm('Cancel this reservation request?')) return
    try { await cancelReservation(id); await load() } catch (err) { setError(formatSupabaseError(err, 'Could not cancel reservation.')) }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div><p className="text-xs font-bold tracking-[0.22em] text-accent uppercase">Campus Crib reservations</p><h1 className="text-2xl font-bold text-primary mt-2">{role === 'landlord' ? 'Reservations on your listings' : 'My room requests'}</h1><p className="text-gray-600 mt-1">{role === 'landlord' ? 'See which students have requested or secured your rooms.' : 'Track rooms you have asked Campus Crib to reserve.'}</p></div>
      {error && <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>}
      {loading ? <div className="text-sm text-gray-500">Loading reservations…</div> : rows.length === 0 ? <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center text-gray-500">{role === 'landlord' ? 'No reservation requests for your listings yet.' : "You don't have any reservation requests yet."}<div className="mt-3"><Link to={role === 'landlord' ? '/landlord' : '/browse'} className="inline-flex rounded-xl bg-primary text-white px-4 py-2 text-sm font-bold">{role === 'landlord' ? 'Back to dashboard' : 'Browse rooms'}</Link></div></div> : <div className="space-y-3">{rows.map(r => <div key={r.id} className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><Link to={`/properties/${r.property_id}`} className="font-bold text-primary hover:underline">{r.properties?.title || 'Listing'}</Link><p className="text-sm text-gray-600 mt-1">{r.properties?.currency} {Number(r.properties?.price || 0).toLocaleString()} / month</p></div><span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold">{labels[r.status] || r.status}</span></div><div className="grid grid-cols-2 gap-3 mt-4 text-sm"><div><span className="text-gray-500">Move-in</span><p className="font-semibold">{r.move_in_date}</p></div><div><span className="text-gray-500">Move-out</span><p className="font-semibold">{r.move_out_date || 'Not set'}</p></div></div>{r.student_note && <p className="mt-3 text-sm text-gray-600">{r.student_note}</p>}{r.admin_note && <p className="mt-3 rounded-xl bg-blue-50 p-3 text-sm text-blue-800">Admin note: {r.admin_note}</p>}{['pending','confirmed'].includes(r.status) && <button onClick={() => cancel(r.id)} className="mt-3 text-sm font-semibold text-red-600 hover:underline">Cancel request</button>}</div>)}</div>}
    </div>
  )
}
