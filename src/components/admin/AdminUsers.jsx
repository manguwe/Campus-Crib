import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { formatSupabaseError } from '../../lib/errorMessages'
import PageLoading from '../ui/PageLoading'
import EmptyState from '../ui/EmptyState'
import ErrorBanner from '../ui/ErrorBanner'
import UserActivityModal from './UserActivityModal'

const ROLE_BADGE_STYLES = {
  student: 'bg-blue-100 text-blue-800',
  landlord: 'bg-purple-100 text-purple-800',
  admin: 'bg-primary text-white',
}

const DURATION_OPTIONS = [
  { value: '7', label: '7 days' },
  { value: '14', label: '14 days' },
  { value: '30', label: '30 days' },
  { value: 'indefinite', label: 'Indefinite (until lifted)' },
]

export default function AdminUsers() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [activityUser, setActivityUser] = useState(null)
  const [suspendingUser, setSuspendingUser] = useState(null)

  async function load() {
    setLoading(true)
    setError('')
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, role, phone, is_suspended, suspension_reason, suspended_until, created_at')
      .order('created_at', { ascending: false })

    if (error) setError(formatSupabaseError(error, 'Could not load users.'))
    else setUsers(data)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function handleUnsuspend(userId) {
    if (!window.confirm('Unsuspend this user? They will be able to use Campus Crib again.')) return

    setBusyId(userId)
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ is_suspended: false, suspension_reason: null, suspended_until: null })
      .eq('id', userId)
    setBusyId(null)

    if (updateError) {
      setError(formatSupabaseError(updateError, 'Could not update this user.'))
      return
    }
    setUsers((prev) =>
      prev.map((u) =>
        u.id === userId ? { ...u, is_suspended: false, suspension_reason: null, suspended_until: null } : u
      )
    )
  }

  async function handleConfirmSuspend(userId, reason, suspendedUntil) {
    setBusyId(userId)
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ is_suspended: true, suspension_reason: reason, suspended_until: suspendedUntil })
      .eq('id', userId)
    setBusyId(null)

    if (updateError) {
      setError(formatSupabaseError(updateError, 'Could not suspend this user.'))
      return
    }
    setUsers((prev) =>
      prev.map((u) =>
        u.id === userId
          ? { ...u, is_suspended: true, suspension_reason: reason, suspended_until: suspendedUntil }
          : u
      )
    )
    setSuspendingUser(null)
  }

  if (loading) return <PageLoading label="Loading users…" />

  if (users.length === 0) {
    return <EmptyState title="No users yet" description="Registered students, landlords and admins will show up here." />
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {error && <div className="p-4"><ErrorBanner message={error} /></div>}

      <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
          <tr>
            <th className="text-left px-4 py-2">Name</th>
            <th className="text-left px-4 py-2">Role</th>
            <th className="text-left px-4 py-2">Phone</th>
            <th className="text-left px-4 py-2">Status</th>
            <th className="text-right px-4 py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-t border-gray-100">
              <td className="px-4 py-3 text-gray-900 font-medium">{u.name}</td>
              <td className="px-4 py-3">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_BADGE_STYLES[u.role]}`}>
                  {u.role}
                </span>
              </td>
              <td className="px-4 py-3 text-gray-600">{u.phone || '—'}</td>
              <td className="px-4 py-3">
                {u.is_suspended ? (
                  <div>
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                      Suspended
                    </span>
                    <p className="text-xs text-gray-400 mt-1">
                      {u.suspended_until
                        ? `Until ${new Date(u.suspended_until).toLocaleDateString()}`
                        : 'Indefinite'}
                      {u.suspension_reason ? ` — ${u.suspension_reason}` : ''}
                    </p>
                  </div>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Active
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-right">
                <div className="flex items-center justify-end gap-3">
                  <button
                    onClick={() => setActivityUser(u)}
                    className="text-gray-500 font-medium hover:text-primary hover:underline transition-colors duration-150"
                  >
                    View activity
                  </button>
                  {u.role !== 'admin' && (
                    <button
                      onClick={() => (u.is_suspended ? handleUnsuspend(u.id) : setSuspendingUser(u))}
                      disabled={busyId === u.id}
                      className="text-gray-700 font-medium hover:underline disabled:opacity-50"
                    >
                      {u.is_suspended ? 'Unsuspend' : 'Suspend'}
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      {activityUser && (
        <UserActivityModal user={activityUser} onClose={() => setActivityUser(null)} />
      )}

      {suspendingUser && (
        <SuspendModal
          user={suspendingUser}
          busy={busyId === suspendingUser.id}
          onCancel={() => setSuspendingUser(null)}
          onConfirm={handleConfirmSuspend}
        />
      )}
    </div>
  )
}

function SuspendModal({ user, busy, onCancel, onConfirm }) {
  const [reason, setReason] = useState('')
  const [duration, setDuration] = useState('7')
  const [formError, setFormError] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    if (!reason.trim()) {
      setFormError('Please enter a reason for the suspension.')
      return
    }
    const suspendedUntil =
      duration === 'indefinite'
        ? null
        : new Date(Date.now() + Number(duration) * 24 * 60 * 60 * 1000).toISOString()
    onConfirm(user.id, reason.trim(), suspendedUntil)
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 space-y-4">
        <p className="font-medium text-gray-900">Suspend {user.name}</p>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
          <textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Duration</label>
          <div className="space-y-1.5">
            {DURATION_OPTIONS.map((opt) => (
              <label key={opt.value} className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="radio"
                  name="suspendDuration"
                  checked={duration === opt.value}
                  onChange={() => setDuration(opt.value)}
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>

        {formError && <p className="text-xs text-red-600">{formError}</p>}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={busy}
            className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-60"
          >
            {busy ? (
              <span className="inline-flex items-center gap-1.5">
                <Loader2 size={14} className="animate-spin" />
                Suspending…
              </span>
            ) : (
              'Suspend user'
            )}
          </button>
          <button type="button" onClick={onCancel} className="text-sm font-medium text-gray-500 hover:underline">
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
