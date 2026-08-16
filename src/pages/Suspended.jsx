import { ShieldAlert, Mail, Phone } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

// Same real contact details as src/pages/Contact.jsx - kept in sync
// manually since there's no shared constants module for them yet.
const CONTACT_PHONE = '0768648291'
const CONTACT_EMAIL = 'campuscribassociates@gmail.com'

export default function Suspended() {
  const { profile, signOut } = useAuth()

  const until = profile?.suspended_until
    ? new Date(profile.suspended_until).toLocaleDateString()
    : null

  return (
    <div className="max-w-md mx-auto bg-white rounded-2xl shadow-sm border border-gray-200 p-6 text-center">
      <div className="inline-flex bg-red-50 rounded-full p-3 mb-3">
        <ShieldAlert size={22} className="text-red-600" />
      </div>
      <h1 className="text-lg font-semibold text-primary">Your account is suspended</h1>

      {profile?.suspension_reason && (
        <p className="text-sm text-gray-700 mt-3">
          <span className="font-medium">Reason:</span> {profile.suspension_reason}
        </p>
      )}

      <p className="text-sm text-gray-500 mt-2">
        {until ? `This suspension is in effect until ${until}.` : 'This suspension is indefinite.'}
      </p>

      <p className="text-sm text-gray-500 mt-4">
        If you believe this is a mistake, or want to resolve it, please contact us:
      </p>

      <div className="flex flex-col items-center gap-2 mt-3">
        <a href={`mailto:${CONTACT_EMAIL}`} className="inline-flex items-center gap-1.5 text-sm text-accent">
          <Mail size={14} />
          {CONTACT_EMAIL}
        </a>
        <a href={`tel:${CONTACT_PHONE}`} className="inline-flex items-center gap-1.5 text-sm text-accent">
          <Phone size={14} />
          {CONTACT_PHONE}
        </a>
      </div>

      <button
        onClick={signOut}
        className="inline-block mt-6 text-sm font-medium text-gray-500 underline"
      >
        Log out
      </button>
    </div>
  )
}
