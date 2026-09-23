import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { STATUS_BADGE_STYLES } from '../../lib/constants'
import { formatSupabaseError } from '../../lib/errorMessages'
import PageLoading from '../ui/PageLoading'
import EmptyState from '../ui/EmptyState'
import ErrorBanner from '../ui/ErrorBanner'

export default function AdminProperties() {
  const [properties, setProperties] = useState([])
  const [landlordNames, setLandlordNames] = useState({}) // landlord_id -> name
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)

  async function load() {
    setLoading(true)
    setError('')

    const { data: props, error: propsError } = await supabase
      .from('properties')
      .select('id, title, price, currency, status, landlord_id, created_at')
      .order('created_at', { ascending: false })

    if (propsError) {
      setError(formatSupabaseError(propsError, 'Could not load properties.'))
      setLoading(false)
      return
    }

    setProperties(props)

    // properties.landlord_id -> landlord_profiles.id -> profiles.id (two
    // hops, no direct FK to profiles) - fetched separately rather than
    // relying on a nested PostgREST embed through that chain.
    const landlordIds = [...new Set(props.map((p) => p.landlord_id))]
    if (landlordIds.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('id, name').in('id', landlordIds)
      const names = {}
      for (const p of profiles || []) names[p.id] = p.name
      setLandlordNames(names)
    }

    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function handleDecision(propertyId, decision) {
    let reason = null
    if (decision === 'rejected') {
      reason = window.prompt('Reason for rejecting this listing (shown to the landlord):') || ''
      if (reason === null) return
    }

    setBusyId(propertyId)
    const { error: updateError } = await supabase
      .from('properties')
      .update({ status: decision, rejection_reason: decision === 'rejected' ? reason : null })
      .eq('id', propertyId)
    setBusyId(null)

    if (updateError) {
      setError(formatSupabaseError(updateError, 'Could not save that decision.'))
      return
    }

    setProperties((prev) => prev.map((p) => (p.id === propertyId ? { ...p, status: decision } : p)))
  }

  async function handleRemove(propertyId) {
    if (!window.confirm('Remove this listing permanently? This also deletes its photos/media/reviews.')) {
      return
    }
    setBusyId(propertyId)
    const { error: deleteError } = await supabase.from('properties').delete().eq('id', propertyId)
    setBusyId(null)

    if (deleteError) {
      setError(formatSupabaseError(deleteError, 'Could not remove this listing.'))
      return
    }
    setProperties((prev) => prev.filter((p) => p.id !== propertyId))
  }

  if (loading) return <PageLoading label="Loading properties…" />

  if (properties.length === 0) {
    return <EmptyState title="No properties yet" description="Listings created by landlords will show up here for review." />
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {error && <div className="p-4"><ErrorBanner message={error} /></div>}

      <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
          <tr>
            <th className="text-left px-4 py-2">Title</th>
            <th className="text-left px-4 py-2">Landlord</th>
            <th className="text-left px-4 py-2">Price</th>
            <th className="text-left px-4 py-2">Status</th>
            <th className="text-right px-4 py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {properties.map((p) => (
            <tr key={p.id} className="border-t border-gray-100">
              <td className="px-4 py-3">
                <Link to={`/properties/${p.id}`} className="text-gray-900 font-medium hover:underline">
                  {p.title}
                </Link>
              </td>
              <td className="px-4 py-3 text-gray-600">{landlordNames[p.landlord_id] || '—'}</td>
              <td className="px-4 py-3 text-gray-600">
                {p.currency} {Number(p.price).toLocaleString()}
              </td>
              <td className="px-4 py-3">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE_STYLES[p.status]}`}>
                  {p.status}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-2">
                  {p.status === 'pending' && (
                    <>
                      <button
                        onClick={() => handleDecision(p.id, 'approved')}
                        disabled={busyId === p.id}
                        className="text-green-700 font-medium hover:underline disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleDecision(p.id, 'rejected')}
                        disabled={busyId === p.id}
                        className="text-red-600 font-medium hover:underline disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => handleRemove(p.id)}
                    disabled={busyId === p.id}
                    className="text-gray-500 hover:underline disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  )
}
