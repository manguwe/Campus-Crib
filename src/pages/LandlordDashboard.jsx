import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { STATUS_BADGE_STYLES } from '../lib/constants'
import { propertySummaryParts } from '../lib/propertyDisplay'

export default function LandlordDashboard() {
  const { user, profile } = useAuth()

  const [verification, setVerification] = useState(null)
  const [properties, setProperties] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState(null)

  async function loadData() {
    setLoading(true)
    setError('')

    const [{ data: lp, error: lpError }, { data: props, error: propsError }] = await Promise.all([
      supabase
        .from('landlord_profiles')
        .select('verification_status')
        .eq('id', user.id)
        .single(),
      // RLS already restricts this to "approved OR mine" - the .eq below
      // is just to skip fetching other landlords' approved listings too,
      // since this page only cares about the current landlord's own.
      supabase
        .from('properties')
        .select(
          'id, title, price, currency, status, room_type, building_type, occupancy, toilet_shared_by, walk_minutes_to_campus, created_at'
        )
        .eq('landlord_id', user.id)
        .order('created_at', { ascending: false }),
    ])

    if (lpError) setError(lpError.message)
    else setVerification(lp)

    if (propsError) setError((prev) => prev || propsError.message)
    else setProperties(props)

    setLoading(false)
  }

  useEffect(() => {
    if (user?.id) loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  async function handleDelete(propertyId) {
    if (!window.confirm('Delete this listing? This also removes its photos/videos and reviews.')) {
      return
    }
    setDeletingId(propertyId)
    const { error: deleteError } = await supabase.from('properties').delete().eq('id', propertyId)
    setDeletingId(null)
    if (deleteError) {
      setError(deleteError.message)
      return
    }
    setProperties((prev) => prev.filter((p) => p.id !== propertyId))
  }

  if (loading) {
    return <p className="text-center text-gray-500">Loading…</p>
  }

  const isVerified = verification?.verification_status === 'approved'

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Landlord dashboard</h2>
        <p className="text-sm text-gray-500">Logged in as {profile?.name}</p>
      </div>

      {!isVerified && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-800 flex items-center justify-between gap-4">
          <span>
            {verification?.verification_status === 'rejected'
              ? 'Your verification was rejected. Resubmit your ID document to start listing properties.'
              : 'Your account is awaiting verification. You can create listings once an admin approves your ID document.'}
          </span>
          <Link
            to="/landlord/verification"
            className="shrink-0 px-3 py-1.5 rounded-lg bg-gray-900 text-white font-medium hover:bg-gray-700"
          >
            Go to verification
          </Link>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h3 className="font-medium text-gray-900">Your listings</h3>
        {isVerified ? (
          <Link
            to="/landlord/properties/new"
            className="px-3 py-1.5 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-700"
          >
            + New listing
          </Link>
        ) : (
          <span className="text-xs text-gray-400">Verify your account to create listings</span>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {properties.length === 0 ? (
        <p className="text-sm text-gray-400">You haven't created any listings yet.</p>
      ) : (
        <ul className="space-y-3">
          {properties.map((p) => (
            <li
              key={p.id}
              className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center justify-between gap-4"
            >
              <div>
                <p className="font-medium text-gray-900">{p.title}</p>
                <p className="text-sm text-gray-500">
                  {p.currency} {Number(p.price).toLocaleString()} / month
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{propertySummaryParts(p).join(' · ')}</p>
              </div>

              <div className="flex items-center gap-3">
                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_BADGE_STYLES[p.status]}`}
                >
                  {p.status}
                </span>
                <Link
                  to={`/landlord/properties/${p.id}`}
                  className="text-sm font-medium text-gray-700 underline"
                >
                  Edit
                </Link>
                <button
                  onClick={() => handleDelete(p.id)}
                  disabled={deletingId === p.id}
                  className="text-sm font-medium text-red-600 underline disabled:opacity-50"
                >
                  {deletingId === p.id ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
