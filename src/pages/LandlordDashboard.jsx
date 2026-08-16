import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Home as HomeIcon, Eye } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { STATUS_BADGE_STYLES } from '../lib/constants'
import { propertySummaryParts } from '../lib/propertyDisplay'
import { useCampuses } from '../context/CampusesContext'
import { formatSupabaseError } from '../lib/errorMessages'
import PageLoading from '../components/ui/PageLoading'
import EmptyState from '../components/ui/EmptyState'
import ErrorBanner from '../components/ui/ErrorBanner'
import AvailabilityStatusControl from '../components/AvailabilityStatusControl'
import ListingStatsModal from '../components/ListingStatsModal'

export default function LandlordDashboard() {
  const { user, profile } = useAuth()
  const { getCampusById } = useCampuses()

  const [verification, setVerification] = useState(null)
  const [properties, setProperties] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState(null)
  const [updatingAvailabilityId, setUpdatingAvailabilityId] = useState(null)
  const [statsByProperty, setStatsByProperty] = useState({})
  const [statsModalProperty, setStatsModalProperty] = useState(null)

  async function loadData() {
    setLoading(true)
    setError('')

    const [{ data: lp, error: lpError }, { data: props, error: propsError }, { data: stats, error: statsError }] =
      await Promise.all([
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
            'id, title, price, currency, status, building_type, occupancy, toilet_shared_by, walk_minutes_to_campus, primary_campus_id, availability_status, created_at'
          )
          .eq('landlord_id', user.id)
          .order('created_at', { ascending: false }),
        // Self-scoped to the caller's own listings server-side (see
        // landlord_property_stats() in 20_visitor_analytics.sql) - a
        // landlord can't use this to see another landlord's numbers.
        supabase.rpc('landlord_property_stats'),
      ])

    if (lpError) setError(formatSupabaseError(lpError))
    else setVerification(lp)

    if (propsError) setError((prev) => prev || formatSupabaseError(propsError, 'Could not load your listings.'))
    else setProperties(props)

    if (!statsError && stats) {
      setStatsByProperty(Object.fromEntries(stats.map((s) => [s.property_id, s])))
    }

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
      setError(formatSupabaseError(deleteError, 'Could not delete this listing.'))
      return
    }
    setProperties((prev) => prev.filter((p) => p.id !== propertyId))
  }

  async function handleAvailabilityChange(propertyId, nextStatus) {
    setUpdatingAvailabilityId(propertyId)
    const { error: updateError } = await supabase
      .from('properties')
      .update({ availability_status: nextStatus })
      .eq('id', propertyId)
    setUpdatingAvailabilityId(null)

    if (updateError) {
      setError(formatSupabaseError(updateError, 'Could not update availability.'))
      return
    }
    setProperties((prev) =>
      prev.map((p) => (p.id === propertyId ? { ...p, availability_status: nextStatus } : p))
    )
  }

  if (loading) {
    return <PageLoading label="Loading your dashboard…" />
  }

  const isVerified = verification?.verification_status === 'approved'

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-primary">Landlord dashboard</h2>
        <p className="text-sm text-gray-500">Logged in as {profile?.name}</p>
      </div>

      {!isVerified && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <span>
            {verification?.verification_status === 'rejected'
              ? 'Your verification was rejected. Resubmit your ID document to start listing properties.'
              : 'Your account is awaiting verification. You can create listings once an admin approves your ID document.'}
          </span>
          <Link
            to="/landlord/verification"
            className="shrink-0 px-3 py-1.5 rounded-lg bg-primary text-white font-medium hover:bg-primary-dark transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] text-center"
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
            className="px-3 py-1.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark transition-all duration-150 hover:scale-[1.02] active:scale-[0.98]"
          >
            + New listing
          </Link>
        ) : (
          <span className="text-xs text-gray-400">Verify your account to create listings</span>
        )}
      </div>

      <ErrorBanner message={error} />

      {properties.length === 0 ? (
        <EmptyState
          icon={HomeIcon}
          title="You haven't created any listings yet"
          description={
            isVerified
              ? "Once you add a listing, it'll show up here for you to manage."
              : 'Get verified first, then create your first listing.'
          }
          action={isVerified ? { label: '+ New listing', to: '/landlord/properties/new' } : undefined}
        />
      ) : (
        <ul className="space-y-3">
          {properties.map((p) => (
            <li
              key={p.id}
              className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex flex-col gap-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 truncate">{p.title}</p>
                  <p className="text-sm text-gray-500">
                    {p.currency} {Number(p.price).toLocaleString()} / month
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {propertySummaryParts(
                      p,
                      p.primary_campus_id ? getCampusById(p.primary_campus_id)?.name : null
                    ).join(' · ')}
                  </p>
                  <button
                    onClick={() => setStatsModalProperty(p)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline mt-1.5"
                  >
                    <Eye size={11} />
                    {statsByProperty[p.id]?.total_views > 0
                      ? `${statsByProperty[p.id].views_last_7_days} views this week`
                      : 'No views yet'}
                  </button>
                </div>

                <div className="flex items-center gap-3 shrink-0">
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
              </div>

              {/* Quick-edit: change availability without opening the full editor. */}
              <div className="pt-3 border-t border-gray-100">
                <AvailabilityStatusControl
                  compact
                  value={p.availability_status || 'available'}
                  onChange={(next) => handleAvailabilityChange(p.id, next)}
                  disabled={updatingAvailabilityId === p.id}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      {statsModalProperty && (
        <ListingStatsModal
          property={statsModalProperty}
          stats={
            statsByProperty[statsModalProperty.id] || {
              total_views: 0,
              views_last_7_days: 0,
              favourites_count: 0,
            }
          }
          onClose={() => setStatsModalProperty(null)}
        />
      )}
    </div>
  )
}
