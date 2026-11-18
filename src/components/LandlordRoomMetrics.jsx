import { useEffect, useMemo, useState } from 'react'
import { METRIC_RANGES, fetchLandlordRoomMetrics, summarizeRooms } from '../lib/landlordMetrics'
import { formatSupabaseError } from '../lib/errorMessages'

function Card({ label, value, hint }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <p className="text-2xl font-bold text-primary mt-1">{value}</p>
      {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
    </div>
  )
}

/** Landlord dashboard figures for their own rooms. Views count every page view in the chosen window. */
export default function LandlordRoomMetrics() {
  const [days, setDays] = useState(30)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true); setError('')
    fetchLandlordRoomMetrics(days)
      .then((data) => { if (!cancelled) setRows(data) })
      .catch((err) => { if (!cancelled) setError(formatSupabaseError(err, 'Could not load your room figures.')) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [days])

  const summary = useMemo(() => summarizeRooms(rows), [rows])

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-medium text-gray-900">Your room figures</h3>
        <div className="inline-flex rounded-xl border border-gray-200 bg-white p-1">
          {METRIC_RANGES.map((r) => (
            <button key={r.label} onClick={() => setDays(r.value)} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${days === r.value ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-50'}`}>{r.label}</button>
          ))}
        </div>
      </div>

      {error && <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>}

      {loading ? <div className="text-sm text-gray-500">Loading figures…</div> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card label="Rooms listed" value={summary.listed} />
            <Card label="Approved" value={summary.approved} />
            <Card label="Rejected" value={summary.rejected} />
            <Card label="Views" value={summary.views} hint={METRIC_RANGES.find((r) => r.value === days)?.label} />
            <Card label="Occupied" value={summary.occupied} hint="Fully booked" />
            <Card label="Unoccupied" value={summary.unoccupied} hint="Available" />
            <Card label="On hold" value={summary.onHold} hint="Includes maintenance or renovation" />
            <Card label="Reservations" value={summary.confirmedReservations} hint="Confirmed by Campus Crib" />
          </div>

          {rows.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <tr><th className="px-4 py-2.5">Room</th><th className="px-4 py-2.5">Approval</th><th className="px-4 py-2.5">Availability</th><th className="px-4 py-2.5 text-right">Views</th><th className="px-4 py-2.5 text-right">Confirmed reservations</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((r) => (
                    <tr key={r.property_id}>
                      <td className="px-4 py-2.5 font-medium text-gray-900">{r.title}</td>
                      <td className="px-4 py-2.5 capitalize text-gray-600">{r.status}</td>
                      <td className="px-4 py-2.5 text-gray-600">{r.availability_status === 'taken' ? 'Occupied' : r.availability_status === 'on_hold' ? 'On hold' : 'Unoccupied'}</td>
                      <td className="px-4 py-2.5 text-right">{r.views}</td>
                      <td className="px-4 py-2.5 text-right">{r.confirmed_reservations}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  )
}
