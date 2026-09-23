import { useEffect, useState } from 'react'
import { Phone, MessageSquare, MessageCircle, Trash2, Plus } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { formatSupabaseError } from '../lib/errorMessages'
import ErrorBanner from './ui/ErrorBanner'
import Spinner from './ui/Spinner'
import Select from './ui/Select'

const CONTACT_TYPE_OPTIONS = [
  { value: 'call', label: 'Call', icon: Phone },
  { value: 'sms', label: 'SMS', icon: MessageSquare },
  { value: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
]

const emptyDraft = { phone_number: '', contact_type: 'call', label: '' }

/** Lives on the property editor, in edit mode only (mirrors
 * PropertyMediaManager's pattern - needs a real property id to attach
 * rows to, so it isn't available until the listing has been created). */
export default function PropertyContactsManager({ propertyId }) {
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState(emptyDraft)
  const [saving, setSaving] = useState(false)
  const [removingId, setRemovingId] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      const { data, error: loadError } = await supabase
        .from('property_contacts')
        .select('id, contact_type, phone_number, label, sort_order')
        .eq('property_id', propertyId)
        .order('sort_order', { ascending: true })

      if (cancelled) return
      if (loadError) setError(formatSupabaseError(loadError, 'Could not load contact numbers.'))
      else setContacts(data)
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [propertyId])

  async function handleAdd() {
    setError('')

    const phone = draft.phone_number.trim()
    if (!phone) {
      setError('Enter a phone number.')
      return
    }
    if (!/^[+\d][\d\s-]{6,}$/.test(phone)) {
      setError('Please enter a valid phone number.')
      return
    }

    setSaving(true)
    const nextSortOrder = contacts.length
    const { data, error: insertError } = await supabase
      .from('property_contacts')
      .insert({
        property_id: propertyId,
        phone_number: phone,
        contact_type: draft.contact_type,
        label: draft.label.trim() || null,
        sort_order: nextSortOrder,
      })
      .select('id, contact_type, phone_number, label, sort_order')
      .single()
    setSaving(false)

    if (insertError) {
      setError(formatSupabaseError(insertError, 'Could not add that contact.'))
      return
    }

    setContacts((prev) => [...prev, data])
    setDraft(emptyDraft)
  }

  async function handleRemove(id) {
    setRemovingId(id)
    const { error: deleteError } = await supabase.from('property_contacts').delete().eq('id', id)
    setRemovingId(null)

    if (deleteError) {
      setError(formatSupabaseError(deleteError, 'Could not remove that contact.'))
      return
    }
    setContacts((prev) => prev.filter((c) => c.id !== id))
  }

  if (loading) return <Spinner label="Loading contact numbers…" />

  return (
    <div className="space-y-3">
      <div>
        <h3 className="flex items-center gap-2 text-sm font-medium text-gray-900">
          <span className="bg-primary/10 text-primary rounded-full p-1.5">
            <Phone size={13} />
          </span>
          Contact numbers
        </h3>
        <p className="text-xs text-gray-500 mt-0.5">
          Add one or more numbers students can use to reach you about this listing - e.g. your own
          number for calls, and a caretaker's number for WhatsApp. If you don't add any, students will
          see your registration phone number instead.
        </p>
      </div>

      <ErrorBanner message={error} />

      {contacts.length > 0 && (
        <ul className="space-y-2">
          {contacts.map((c) => {
            const typeInfo = CONTACT_TYPE_OPTIONS.find((t) => t.value === c.contact_type)
            const Icon = typeInfo?.icon || Phone
            return (
              <li
                key={c.id}
                className="flex items-center justify-between gap-3 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2"
              >
                <div className="flex items-center gap-2 min-w-0 text-sm">
                  <Icon size={14} className="text-gray-500 shrink-0" />
                  <span className="font-medium text-gray-900">{c.phone_number}</span>
                  <span className="text-gray-400 text-xs shrink-0">
                    ({typeInfo?.label || c.contact_type})
                  </span>
                  {c.label && <span className="text-gray-500 truncate">— {c.label}</span>}
                </div>
                <button
                  type="button"
                  onClick={() => handleRemove(c.id)}
                  disabled={removingId === c.id}
                  aria-label="Remove this contact"
                  className="shrink-0 text-gray-400 hover:text-red-600 disabled:opacity-50"
                >
                  <Trash2 size={15} />
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-600 mb-1">Phone number</label>
          <input
            type="text"
            value={draft.phone_number}
            onChange={(e) => setDraft((d) => ({ ...d, phone_number: e.target.value }))}
            placeholder="e.g. 0977123456"
            />
        </div>
        <div className="sm:w-32">
          <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
          <Select
            value={draft.contact_type}
            onChange={(e) => setDraft((d) => ({ ...d, contact_type: e.target.value }))}
            >
            {CONTACT_TYPE_OPTIONS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="sm:w-40">
          <label className="block text-xs font-medium text-gray-600 mb-1">Label (optional)</label>
          <input
            type="text"
            value={draft.label}
            onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
            placeholder="e.g. Caretaker"
            />
        </div>
        <button
          type="button"
          onClick={handleAdd}
          disabled={saving}
          className="flex items-center justify-center gap-1 shrink-0 px-3 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60"
        >
          <Plus size={14} />
          {saving ? 'Adding…' : 'Add'}
        </button>
      </div>
    </div>
  )
}
