import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Phone, MessageSquare, MessageCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import PhoneContactLinks from './PhoneContactLinks'
import { telLink, smsLink, whatsappLink } from '../lib/phone'
import { formatSupabaseError } from '../lib/errorMessages'
import Spinner from './ui/Spinner'

const CONTACT_TYPE_META = {
  call: { icon: Phone, label: 'Call', href: telLink },
  sms: { icon: MessageSquare, label: 'SMS', href: smsLink },
  whatsapp: { icon: MessageCircle, label: 'WhatsApp', href: whatsappLink },
}

export default function ContactLandlordButton({ propertyId, landlordId }) {
  const { session } = useAuth()
  const [landlord, setLandlord] = useState(null)
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!session) return

    async function load() {
      setLoading(true)

      // Multiple labeled numbers take priority when present; profiles
      // (the landlord's registration phone) is only fetched as a
      // fallback for listings with zero property_contacts rows.
      const [{ data: contactRows, error: contactsError }, { data: profileRow, error: profileError }] =
        await Promise.all([
          supabase
            .from('property_contacts')
            .select('id, contact_type, phone_number, label, sort_order')
            .eq('property_id', propertyId)
            .order('sort_order', { ascending: true }),
          supabase.from('profiles').select('name, phone').eq('id', landlordId).single(),
        ])

      if (contactsError) {
        setError(formatSupabaseError(contactsError, 'Could not load contact details.'))
        setLoading(false)
        return
      }
      if (profileError) {
        setError(formatSupabaseError(profileError, 'Could not load contact details.'))
        setLoading(false)
        return
      }

      setContacts(contactRows || [])
      setLandlord(profileRow)
      setLoading(false)
    }

    load()
  }, [session, propertyId, landlordId])

  if (!session) {
    return (
      <Link
        to="/login"
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark transition-all duration-150 hover:scale-[1.02] active:scale-[0.98]"
      >
        <Phone size={16} />
        Log in to contact landlord
      </Link>
    )
  }

  if (loading) {
    return <Spinner label="Loading contact details…" />
  }

  if (error || !landlord) {
    return <p className="text-sm text-red-600">{error || 'Could not load landlord contact details.'}</p>
  }

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm">
      <p className="font-medium text-gray-900">{landlord.name}</p>

      {contacts.length > 0 ? (
        <ul className="mt-2 space-y-2">
          {contacts.map((c) => {
            const meta = CONTACT_TYPE_META[c.contact_type] || CONTACT_TYPE_META.call
            const Icon = meta.icon
            return (
              <li key={c.id} className="flex items-center gap-2">
                <a
                  href={meta.href(c.phone_number)}
                  target={c.contact_type === 'whatsapp' ? '_blank' : undefined}
                  rel={c.contact_type === 'whatsapp' ? 'noreferrer' : undefined}
                  className="inline-flex items-center gap-1.5 text-gray-700 hover:text-primary font-medium"
                >
                  <Icon size={14} />
                  {c.phone_number}
                </a>
                <span className="text-xs text-gray-400">
                  {meta.label}
                  {c.label ? ` · ${c.label}` : ''}
                </span>
              </li>
            )
          })}
        </ul>
      ) : landlord.phone ? (
        <PhoneContactLinks phone={landlord.phone} className="mt-1.5" />
      ) : (
        <p className="text-gray-400 mt-1">No phone number on file.</p>
      )}
    </div>
  )
}
