import { useEffect, useState } from 'react'
import { Loader2, ShieldCheck } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { formatSupabaseError } from '../lib/errorMessages'
import { useAgentsProgram } from '../hooks/useAgentsProgram'

/** Private owner details for a listing posted by an agent. Only the agent and Campus Crib admins can see this. */
export default function AgentOwnerDetails({ propertyId }) {
  const { enabled: programOn } = useAgentsProgram()
  const [ownerName, setOwnerName] = useState('')
  const [ownerPhone, setOwnerPhone] = useState('')
  const [consent, setConsent] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data } = await supabase
        .from('property_owner_details')
        .select('owner_name, owner_phone, owner_consent')
        .eq('property_id', propertyId)
        .maybeSingle()
      if (cancelled) return
      if (data) {
        setOwnerName(data.owner_name || '')
        setOwnerPhone(data.owner_phone || '')
        setConsent(Boolean(data.owner_consent))
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [propertyId])

  async function handleSave(e) {
    e.preventDefault()
    setError('')
    setMessage('')
    if (!ownerName.trim() || !ownerPhone.trim()) {
      setError('Please enter the owner\'s name and phone number.')
      return
    }
    if (!consent) {
      setError('Please confirm the owner has agreed to this listing.')
      return
    }
    setSaving(true)
    const { error: saveError } = await supabase.from('property_owner_details').upsert(
      {
        property_id: propertyId,
        owner_name: ownerName.trim(),
        owner_phone: ownerPhone.trim(),
        owner_consent: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'property_id' },
    )
    setSaving(false)
    if (saveError) setError(formatSupabaseError(saveError, 'Could not save the owner details.'))
    else setMessage('Owner details saved. Our team may call the owner to confirm the listing.')
  }

  if (loading) return null

  return (
    <form onSubmit={handleSave} className="space-y-3">
      <div className="flex items-center gap-2 text-primary">
        <ShieldCheck size={18} />
        <h3 className="font-semibold">Owner details (private)</h3>
      </div>
      <p className="text-sm text-gray-600">
        Only Campus Crib admins can see this. We use it to confirm the listing with the owner before it goes live. A listing
        cannot be approved without it.
      </p>
      {!programOn && (
        <p className="text-sm text-amber-700">The agent program is paused, so these details can't be changed right now.</p>
      )}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Owner's full name</label>
        <input
          type="text"
          value={ownerName}
          onChange={(e) => setOwnerName(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Owner's phone number</label>
        <input
          type="tel"
          value={ownerPhone}
          onChange={(e) => setOwnerPhone(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </div>
      <label className="flex items-start gap-2 text-sm text-gray-600">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5 rounded border-gray-300 text-accent focus:ring-accent"
        />
        <span>The owner has agreed to this house being listed on Campus Crib.</span>
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {message && <p className="text-sm text-accent">{message}</p>}
      <button
        type="submit"
        disabled={saving || !programOn}
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
      >
        {saving && <Loader2 size={15} className="animate-spin" />}
        Save owner details
      </button>
    </form>
  )
}
