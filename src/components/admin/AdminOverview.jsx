import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { formatSupabaseError } from '../../lib/errorMessages'
import PageLoading from '../ui/PageLoading'
import ErrorBanner from '../ui/ErrorBanner'

async function countRows(table, filters = {}) {
  let query = supabase.from(table).select('*', { count: 'exact', head: true })
  for (const [col, val] of Object.entries(filters)) {
    query = query.eq(col, val)
  }
  const { count, error } = await query
  if (error) throw error
  return count ?? 0
}

export default function AdminOverview() {
  const [stats, setStats] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const [
          totalStudents,
          totalLandlords,
          totalProperties,
          pendingProperties,
          approvedProperties,
          rejectedProperties,
          pendingVerifications,
        ] = await Promise.all([
          countRows('profiles', { role: 'student' }),
          countRows('profiles', { role: 'landlord' }),
          countRows('properties'),
          countRows('properties', { status: 'pending' }),
          countRows('properties', { status: 'approved' }),
          countRows('properties', { status: 'rejected' }),
          countRows('landlord_profiles', { verification_status: 'pending' }),
        ])

        setStats({
          totalStudents,
          totalLandlords,
          totalProperties,
          pendingProperties,
          approvedProperties,
          rejectedProperties,
          pendingVerifications,
        })
      } catch (err) {
        setError(formatSupabaseError(err, 'Could not load dashboard stats.'))
      }
    }
    load()
  }, [])

  if (error) return <ErrorBanner message={error} />
  if (!stats) return <PageLoading label="Loading dashboard stats…" />

  const cards = [
    { label: 'Students', value: stats.totalStudents },
    { label: 'Landlords', value: stats.totalLandlords },
    { label: 'Total properties', value: stats.totalProperties },
    { label: 'Pending listings', value: stats.pendingProperties },
    { label: 'Approved listings', value: stats.approvedProperties },
    { label: 'Rejected listings', value: stats.rejectedProperties },
    { label: 'Pending verifications', value: stats.pendingVerifications },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {cards.map((c) => (
        <div key={c.label} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
          <p className="text-2xl font-bold text-gray-900">{c.value}</p>
          <p className="text-sm text-gray-500 mt-0.5">{c.label}</p>
        </div>
      ))}
    </div>
  )
}
