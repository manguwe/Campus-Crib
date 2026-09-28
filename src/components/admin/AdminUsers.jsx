import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mail, MessageCircle, Phone } from 'lucide-react'
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

function whatsappNumber(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  const digits = raw.replace(/\D/g, '')
  if (digits.startsWith('00')) return digits.slice(2)
  // Campus Crib is Zambia-focused. Convert the common local 10-digit
  // format (0977xxxxxx / 0966xxxxxx / 0955xxxxxx) to +260 for wa.me.
  if (digits.length === 10 && digits.startsWith('0')) return `260${digits.slice(1)}`
  return digits
}

function buildWhatsAppUrl(user) {
  const number = whatsappNumber(user.whatsapp || user.contact_phone || user.phone)
  if (!number) return ''
  const message = [
    `Hello ${user.name || 'there'},`,
    '',
    'This is Campus Crib Admin. We have seen that you registered on the Campus Crib platform.',
    'Thank you for joining Campus Crib.',
    '',
    'If you have any questions, a complaint, or need help with your account or a listing, please let us know here and our team will assist you.',
    '',
    '— Campus Crib Admin',
  ].join('\n')
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`
}

function buildEmailUrl(user) {
  const email = user.email || user.contact_email
  if (!email) return ''
  const subject = 'Campus Crib — Welcome & Support'
  const body = [
    `Hello ${user.name || 'there'},`,
    '',
    'This is Campus Crib Admin. We have seen that you registered on the Campus Crib platform.',
    'Thank you for joining Campus Crib.',
    '',
    'If you have any questions, a complaint, or need help with your account or a listing, please reply to this email and our team will assist you.',
    '',
    '— Campus Crib Admin',
  ].join('\n')
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

function WhatsAppIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M20.52 3.48A11.82 11.82 0 0 0 12.08 0C5.55 0 .24 5.31.24 11.84c0 2.09.55 4.13 1.59 5.93L.16 24l6.37-1.67a11.82 11.82 0 0 0 5.55 1.39h.01c6.53 0 11.84-5.31 11.84-11.84 0-3.17-1.23-6.14-3.41-8.4ZM12.09 21.7h-.01a9.82 9.82 0 0 1-5.01-1.37l-.36-.21-3.78.99 1.01-3.69-.23-.38a9.82 9.82 0 1 1 8.38 4.66Zm5.39-7.37c-.29-.15-1.72-.85-1.99-.95-.27-.1-.46-.15-.65.15-.19.29-.75.95-.92 1.14-.17.19-.34.22-.63.07-.29-.15-1.2-.44-2.28-1.4-.84-.75-1.4-1.67-1.56-1.95-.16-.29-.02-.44.12-.59.13-.13.29-.34.44-.51.15-.17.19-.29.29-.49.1-.19.05-.37-.02-.51-.07-.15-.65-1.57-.89-2.15-.23-.56-.47-.48-.65-.49h-.56c-.19 0-.49.07-.75.37-.26.29-1  .98-1 2.4s1.03 2.78 1.18 2.97c.15.19 2.02 3.08 4.9 4.32.68.29 1.21.46 1.62.59.68.22 1.3.19 1.79.12.55-.08 1.72-.7 1.96-1.38.24-.68.24-1.27.17-1.38-.07-.12-.26-.19-.55-.34Z" />
    </svg>
  )
}

export default function AdminUsers() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [activityUser, setActivityUser] = useState(null)
  const [suspendingUser, setSuspendingUser] = useState(null)
  const navigate = useNavigate()

  async function load() {
    setLoading(true)
    setError('')
    const { data, error } = await supabase.rpc('get_admin_user_directory')

    if (error) setError(formatSupabaseError(error, 'Could not load users.'))
    else setUsers(data || [])
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
            <th className="text-left px-4 py-2">Contact</th>
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
              <td className="px-4 py-3">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2 text-gray-700">
                    {u.phone ? <a href={`tel:${u.phone}`} className="inline-flex items-center gap-1 hover:text-primary"><Phone size={14}/> {u.phone}</a> : <span className="text-gray-400">No phone number on file</span>}
                    {u.contact_phone && u.contact_phone !== u.phone && <span className="text-xs text-gray-400">Contact: {u.contact_phone}</span>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {u.email && <a href={buildEmailUrl(u)} className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 hover:text-primary hover:border-primary/30"><Mail size={13}/> Email</a>}
                    {(u.phone || u.contact_phone || u.whatsapp) && <a href={buildWhatsAppUrl(u)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 hover:text-primary hover:border-primary/30"><WhatsAppIcon size={14}/> WhatsApp</a>}
                    {u.contact_email && u.contact_email !== u.email && <a href={`mailto:${u.contact_email}`} className="inline-flex items-center gap-1 text-gray-500 hover:text-primary"><Mail size={13}/> {u.contact_email}</a>}
                  </div>
                </div>
              </td>
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
                <div className="flex items-center justify-end gap-2 flex-wrap">
                  {u.role !== 'admin' && <button
                    onClick={async () => {
                      setError('')
                      const { data: conversationId, error: chatError } = await supabase.rpc('start_direct_conversation', { p_target_user_id: u.id })
                      if (chatError) { setError(formatSupabaseError(chatError, 'Could not start the conversation.')); return }
                      navigate(`/messages?conversation=${conversationId}`)
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:text-primary"
                  ><MessageCircle size={14}/> Message</button>}
                  {u.phone && <a href={`tel:${u.phone}`} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-700"><Phone size={14}/> Call</a>}
                  {(u.email || u.contact_email) && <a href={buildEmailUrl(u)} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-700"><Mail size={14}/> Email</a>}
                  {(u.phone || u.contact_phone || u.whatsapp) && <a href={buildWhatsAppUrl(u)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-700"><WhatsAppIcon size={14}/> WhatsApp</a>}
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
