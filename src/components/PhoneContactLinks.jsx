import { Phone, MessageSquare } from 'lucide-react'
import { telLink, smsLink } from '../lib/phone'

/** Simple Call + Text link pair for a single phone number - used as the
 * fallback when a listing has no property_contacts entries (see
 * ContactLandlordButton), and anywhere else a bare phone number needs to
 * be clickable. */
export default function PhoneContactLinks({ phone, className = '' }) {
  if (!phone) return null

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <a
        href={telLink(phone)}
        className="inline-flex items-center gap-1.5 text-gray-700 hover:text-primary text-sm font-medium"
      >
        <Phone size={14} />
        {phone}
      </a>
      <a
        href={smsLink(phone)}
        className="inline-flex items-center gap-1.5 text-gray-500 hover:text-primary text-sm"
      >
        <MessageSquare size={14} />
        Text
      </a>
    </div>
  )
}
