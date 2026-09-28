import { useState } from 'react'
import { Phone, ShieldCheck } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { isValidPhone } from '../lib/phone'
import { formatSupabaseError } from '../lib/errorMessages'
import ErrorBanner from './ui/ErrorBanner'
import { useAuth } from '../context/AuthContext'

export default function CompletePhoneGate({ children }) {
  const { session, profile, refreshProfile } = useAuth()
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  // Admins may still use the system even if their legacy account has no phone.
  // Students and landlords need a mobile number for reservation/contact support.
  const needsPhone = Boolean(session && profile && ['student', 'landlord'].includes(profile.role) && !profile.phone)

  if (!needsPhone) return children

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!isValidPhone(phone)) {
      setError('Please enter a valid mobile number, for example 0977123456 or +260977123456.')
      return
    }

    setSaving(true)
    const { error: updateError } = await supabase.rpc('update_my_phone', { p_phone: phone.trim() })
    if (updateError) {
      setError(formatSupabaseError(updateError, 'Could not save your mobile number. Please try again.'))
      setSaving(false)
      return
    }

    await refreshProfile()
    setSaving(false)
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center py-8">
      <div className="max-w-md w-full bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="inline-flex rounded-full bg-blue-50 text-primary p-3 mb-4">
          <Phone size={22} />
        </div>
        <h2 className="text-xl font-bold text-primary">Add your mobile number</h2>
        <p className="text-sm text-gray-600 mt-2">
          Your Campus Crib account was created without a mobile number. We now require one so the
          Campus Crib team can contact you about reservations, listings, complaints, or account support.
        </p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mobile number</label>
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 0977123456"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              required
            />
          </div>
          <ErrorBanner message={error} />
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg bg-primary text-white py-2.5 text-sm font-semibold disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save mobile number'}
          </button>
        </form>

        <p className="flex items-start gap-2 text-xs text-gray-400 mt-4">
          <ShieldCheck size={14} className="mt-0.5 shrink-0" />
          Your mobile number is used for Campus Crib contact and support workflows.
        </p>
      </div>
    </div>
  )
}
