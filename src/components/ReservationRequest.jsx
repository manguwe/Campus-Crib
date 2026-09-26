import { useEffect, useState } from 'react'
import { CalendarDays, CheckCircle2, Clock3, Users, XCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { getReservationStatus, requestReservation } from '../lib/reservations'
import { formatSupabaseError } from '../lib/errorMessages'

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

export default function ReservationRequest({ property }) {
  const { user, role } = useAuth()
  const [reservation, setReservation] = useState(null)
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [moveIn, setMoveIn] = useState('')
  const [moveOut, setMoveOut] = useState('')
  const [occupants, setOccupants] = useState(1)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    try {
      const status = await getReservationStatus(property.id)
      setReservation(status)
    } catch (err) {
      setError(formatSupabaseError(err, 'Could not check reservation status.'))
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [property.id])

  if (role !== 'student' || !user || property.landlord_id === user.id) return null
  if (loading) return <div className="mt-3 text-xs text-gray-400">Checking reservation availability…</div>

  const reserved = Boolean(reservation?.is_reserved)

  async function submit(e) {
    e.preventDefault(); setError(''); setSaving(true)
    try {
      await requestReservation({ propertyId: property.id, moveInDate: moveIn, moveOutDate: moveOut, occupants, note })
      setOpen(false)
      await load()
    } catch (err) {
      setError(formatSupabaseError(err, 'Could not submit the reservation request.'))
    } finally { setSaving(false) }
  }

  return (
    <div className="mt-4 rounded-2xl border border-primary/10 bg-primary/[0.03] p-4">
      {reserved ? (
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-amber-100 p-2 text-amber-700"><Clock3 size={19} /></div>
          <div>
            <h3 className="font-bold text-primary">Room reserved</h3>
            <p className="text-sm text-gray-600 mt-1">This room is currently reserved for another student. You can browse other listings or contact Campus Crib support.</p>
          </div>
        </div>
      ) : !open ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-primary flex items-center gap-2"><CalendarDays size={18}/> Need this room?</h3>
            <p className="text-sm text-gray-600 mt-1">Send Campus Crib a reservation request with your intended move-in date.</p>
          </div>
          <button onClick={() => setOpen(true)} className="rounded-xl bg-accent text-white px-4 py-2.5 text-sm font-bold hover:opacity-95">Request this room</button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div className="flex items-center justify-between"><div><h3 className="font-bold text-primary">Reserve this room</h3><p className="text-xs text-gray-500">Your request is reviewed by Campus Crib before the room is reserved.</p></div><button type="button" onClick={() => setOpen(false)} className="text-sm text-gray-500">Close</button></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-sm font-medium text-gray-700">Move-in date<input required min={todayIso()} type="date" value={moveIn} onChange={e => setMoveIn(e.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5" /></label>
            <label className="text-sm font-medium text-gray-700">Expected move-out (optional)<input min={moveIn || todayIso()} type="date" value={moveOut} onChange={e => setMoveOut(e.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5" /></label>
          </div>
          <label className="text-sm font-medium text-gray-700 flex items-center gap-2"> <Users size={16}/> Occupants<input required min="1" max={property.occupancy || 10} type="number" value={occupants} onChange={e => setOccupants(e.target.value)} className="w-24 rounded-xl border border-gray-200 px-3 py-2.5" /></label>
          <label className="text-sm font-medium text-gray-700">Anything we should know?<textarea rows="3" value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. I need the room for the next academic term." className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5" /></label>
          {error && <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>}
          <button disabled={saving} className="w-full rounded-xl bg-accent text-white py-3 font-bold disabled:opacity-60">{saving ? 'Sending request…' : 'Send reservation request'}</button>
        </form>
      )}
    </div>
  )
}
