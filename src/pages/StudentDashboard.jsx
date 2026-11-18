import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, Heart, Home, MessageCircle, Search } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import PushNotificationBanner from '../components/PushNotificationBanner'
import PushNotificationToggle from '../components/PushNotificationToggle'
import { formatSupabaseError } from '../lib/errorMessages'

const REQUEST_STATUS = { pending: 'Waiting for review', confirmed: 'Confirmed', rejected: 'Not approved', cancelled: 'Cancelled', expired: 'Expired' }
const PAYMENT_STATUS = {
  awaiting_payment: 'Payment due',
  rejected: 'Payment proof rejected, please resubmit',
  proof_submitted: 'Proof sent, being checked',
  verified: 'Payment verified',
}

function Section({ title, action, children }) {
  return (
    <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-primary">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

export default function StudentDashboard() {
  const { user, profile } = useAuth()
  const [saved, setSaved] = useState([])
  const [requests, setRequests] = useState([])
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) return
    let cancelled = false
    async function load() {
      setLoading(true); setError('')
      try {
        const [favRes, resRes, notRes] = await Promise.all([
          supabase.from('favourites').select('property_id').eq('student_id', user.id).order('created_at', { ascending: false }).limit(20),
          supabase.from('reservations').select('id, property_id, status, payment_status, move_in_date, reference_code, created_at').eq('student_id', user.id).order('created_at', { ascending: false }).limit(10),
          supabase.from('notifications').select('id, message, is_read, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(5),
        ])
        if (favRes.error) throw favRes.error
        if (resRes.error) throw resRes.error
        if (notRes.error) throw notRes.error

        const ids = [...new Set([...(favRes.data || []), ...(resRes.data || [])].map((r) => r.property_id).filter(Boolean))]
        const { data: props, error: propsError } = ids.length
          ? await supabase.from('properties').select('id, title, price, currency').in('id', ids)
          : { data: [], error: null }
        if (propsError) throw propsError
        const byId = Object.fromEntries((props || []).map((p) => [p.id, p]))

        if (cancelled) return
        setSaved((favRes.data || []).map((f) => byId[f.property_id]).filter(Boolean).slice(0, 4))
        setRequests((resRes.data || []).map((r) => ({ ...r, room: byId[r.property_id] || null })))
        setNotes(notRes.data || [])
      } catch (err) {
        if (!cancelled) setError(formatSupabaseError(err, 'Could not load your dashboard.'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [user?.id])

  const unread = notes.filter((n) => !n.is_read).length

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <PushNotificationBanner />

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <h1 className="text-xl font-bold text-primary">Welcome, {profile?.name || 'student'}</h1>
        <p className="text-sm text-gray-500 mt-1">Find a room, follow your requests, and keep in touch with landlords and Campus Crib.</p>
        <div className="flex flex-wrap gap-3 mt-4">
          <Link to="/browse" className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark"><Search size={15}/> Browse rooms</Link>
          <Link to="/messages" className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50"><MessageCircle size={15}/> Messages</Link>
          <Link to="/favourites" className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50"><Heart size={15}/> Saved rooms</Link>
        </div>
      </div>

      {error && <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>}
      {loading && <div className="text-sm text-gray-500">Loading your dashboard…</div>}

      {!loading && (
        <>
          <Section title="Saved rooms" action={<Link to="/favourites" className="text-sm font-medium text-accent">See all</Link>}>
            {saved.length === 0 ? <p className="text-sm text-gray-500">No saved rooms yet. Tap the heart on a room to save it.</p> : (
              <ul className="divide-y divide-gray-100">
                {saved.map((p) => (
                  <li key={p.id} className="py-2.5 flex items-center justify-between gap-3 text-sm">
                    <Link to={`/properties/${p.id}`} className="font-medium text-gray-900 hover:text-primary truncate">{p.title}</Link>
                    <span className="text-gray-500 shrink-0">{p.currency} {Number(p.price).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="My room requests">
            {requests.length === 0 ? <p className="text-sm text-gray-500">You have not requested a room yet.</p> : (
              <ul className="divide-y divide-gray-100">
                {requests.map((r) => (
                  <li key={r.id} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-sm">
                    <div className="min-w-0">
                      <Link to={r.room ? `/properties/${r.property_id}` : '/reservations'} className="font-medium text-gray-900 hover:text-primary truncate block">{r.room?.title || 'Room'}</Link>
                      <p className="text-xs text-gray-500">Move-in {r.move_in_date}{r.reference_code ? ` · Ref ${r.reference_code}` : ''}</p>
                    </div>
                    <div className="text-xs text-right shrink-0">
                      <p className="font-semibold text-gray-800">{REQUEST_STATUS[r.status] || r.status}</p>
                      {r.payment_status && PAYMENT_STATUS[r.payment_status] && <p className="text-gray-500">{PAYMENT_STATUS[r.payment_status]}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <Link to="/reservations" className="inline-flex items-center gap-1 text-sm font-medium text-accent"><Home size={14}/> Open all requests</Link>
          </Section>

          <Section title={unread > 0 ? `Notifications (${unread} new)` : 'Notifications'} action={<Bell size={16} className="text-gray-400" />}>
            {notes.length === 0 ? <p className="text-sm text-gray-500">No notifications yet.</p> : (
              <ul className="space-y-2">
                {notes.map((n) => (
                  <li key={n.id} className={`rounded-xl border p-3 text-sm ${n.is_read ? 'border-gray-100 text-gray-600' : 'border-primary/20 bg-primary/[0.03] text-gray-900'}`}>
                    <p>{n.message}</p>
                    <p className="text-xs text-gray-400 mt-1">{new Date(n.created_at).toLocaleString()}</p>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </>
      )}

      <PushNotificationToggle />
    </div>
  )
}
