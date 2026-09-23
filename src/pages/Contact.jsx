import { useRef, useState } from 'react'
import {
  Phone,
  MessageSquare,
  Facebook,
  MessageCircle,
  Mail,
  GraduationCap,
  Building2,
  Handshake,
  CheckCircle2,
  Loader2,
} from 'lucide-react'
import { telLink, smsLink, whatsappLink } from '../lib/phone'
import { supabase } from '../lib/supabaseClient'
import { formatSupabaseError } from '../lib/errorMessages'
import ErrorBanner from '../components/ui/ErrorBanner'
import Select from '../components/ui/Select'

// Placeholders — edit these with the platform's real contact details.
const CONTACT_PHONE = '0768648291'
const FACEBOOK_URL = 'https://www.facebook.com/14m21m5MWit/'
const CONTACT_EMAIL = 'campuscribassociates@gmail.com'

const ROLE_CARDS = [
  {
    value: 'student',
    icon: GraduationCap,
    title: 'Students',
    body: 'Questions about a listing, how verification works, or trouble finding a place near your campus.',
  },
  {
    value: 'landlord',
    icon: Building2,
    title: 'Landlords',
    body: 'Ready to list a property, need help with verification, or want to update an existing listing.',
  },
  {
    value: 'university_partner',
    icon: Handshake,
    title: 'Universities & Partners',
    body: 'Exploring a partnership, want a demo, or have a question about how Campus Crib works with your institution.',
  },
]

const ROLE_OPTIONS = [
  { value: 'student', label: 'Student' },
  { value: 'landlord', label: 'Landlord' },
  { value: 'university_partner', label: 'University or Partner' },
  { value: 'other', label: 'Other' },
]

export default function Contact() {
  const formRef = useRef(null)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  function handleRoleCard(value) {
    setRole(value)
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!name.trim()) {
      setError('Please enter your name.')
      return
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('Please enter a valid email address.')
      return
    }
    if (!role) {
      setError('Please let us know who you are reaching out as.')
      return
    }
    if (!message.trim()) {
      setError('Please enter a message.')
      return
    }
    if (message.trim().length > 2000) {
      setError('Message must be under 2000 characters.')
      return
    }

    setSubmitting(true)
    const { error: insertError } = await supabase.from('contact_messages').insert({
      name: name.trim(),
      email: email.trim(),
      role,
      message: message.trim(),
    })
    setSubmitting(false)

    if (insertError) {
      setError(formatSupabaseError(insertError, 'Could not send your message. Please try again.'))
      return
    }

    setSubmitted(true)
    setName('')
    setEmail('')
    setRole('')
    setMessage('')
  }

  return (
    <div className="space-y-16">
      {/* Hero */}
      <section className="max-w-2xl mx-auto text-center pt-4">
        <h1 className="text-3xl sm:text-4xl font-bold text-primary leading-tight">
          However you reach us, we're glad you did.
        </h1>
        <p className="text-gray-600 mt-4 leading-relaxed">
          Whether you're searching for a room, listing a property, or exploring a partnership with
          your university, our team is ready to help.
        </p>
      </section>

      {/* Who are you reaching out as? */}
      <section className="max-w-4xl mx-auto">
        <h2 className="text-xl font-semibold text-primary text-center mb-6">
          Who are you reaching out as?
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {ROLE_CARDS.map((card) => (
            <div
              key={card.value}
              className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 text-center flex flex-col items-center"
            >
              <div className="inline-flex bg-primary/10 rounded-full p-3 mb-3">
                <card.icon size={20} className="text-primary" />
              </div>
              <p className="font-semibold text-gray-900">{card.title}</p>
              <p className="text-sm text-gray-500 mt-2 leading-relaxed flex-1">{card.body}</p>
              <button
                onClick={() => handleRoleCard(card.value)}
                className="mt-4 text-sm font-medium text-accent hover:underline"
              >
                Message us
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Reach us directly */}
      <section className="max-w-lg mx-auto space-y-5">
        <h2 className="text-xl font-semibold text-primary text-center">Reach us directly</h2>

        {/* WhatsApp is deliberately the most prominent CTA on the page. */}
        <a
          href={whatsappLink(CONTACT_PHONE)}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-center gap-2 w-full rounded-2xl bg-accent text-white py-4 text-base font-semibold shadow-sm hover:bg-accent-dark transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] transition-colors"
        >
          <MessageCircle size={20} />
          Chat with us on WhatsApp
        </a>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <a
            href={telLink(CONTACT_PHONE)}
            className="flex flex-col items-center gap-1.5 bg-white rounded-2xl border border-gray-200 shadow-sm p-4 hover:border-primary/40 hover:shadow-sm transition-all"
          >
            <div className="bg-primary/10 rounded-full p-2.5">
              <Phone size={18} className="text-primary" />
            </div>
            <span className="text-sm font-medium text-gray-900">Call</span>
            <span className="text-xs text-gray-400">{CONTACT_PHONE}</span>
          </a>

          <a
            href={smsLink(CONTACT_PHONE)}
            className="flex flex-col items-center gap-1.5 bg-white rounded-2xl border border-gray-200 shadow-sm p-4 hover:border-primary/40 hover:shadow-sm transition-all"
          >
            <div className="bg-primary/10 rounded-full p-2.5">
              <MessageSquare size={18} className="text-primary" />
            </div>
            <span className="text-sm font-medium text-gray-900">SMS</span>
            <span className="text-xs text-gray-400">{CONTACT_PHONE}</span>
          </a>

          <a
            href={FACEBOOK_URL}
            target="_blank"
            rel="noreferrer"
            className="flex flex-col items-center gap-1.5 bg-white rounded-2xl border border-gray-200 shadow-sm p-4 hover:border-primary/40 hover:shadow-sm transition-all"
          >
            <div className="bg-primary/10 rounded-full p-2.5">
              <Facebook size={18} className="text-primary" />
            </div>
            <span className="text-sm font-medium text-gray-900">Facebook</span>
            <span className="text-xs text-gray-400">Our page</span>
          </a>

          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="flex flex-col items-center gap-1.5 bg-white rounded-2xl border border-gray-200 shadow-sm p-4 hover:border-primary/40 hover:shadow-sm transition-all"
          >
            <div className="bg-primary/10 rounded-full p-2.5">
              <Mail size={18} className="text-primary" />
            </div>
            <span className="text-sm font-medium text-gray-900">Email</span>
            <span className="text-xs text-gray-400 break-all text-center">{CONTACT_EMAIL}</span>
          </a>
        </div>
      </section>

      {/* Contact form */}
      <section ref={formRef} className="max-w-lg mx-auto scroll-mt-20">
        <h2 className="text-xl font-semibold text-primary text-center mb-6">Send us a message</h2>

        {submitted ? (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
            <div className="inline-flex bg-accent/10 rounded-full p-3 mb-3">
              <CheckCircle2 size={22} className="text-accent" />
            </div>
            <p className="font-medium text-gray-900">Thanks — we'll get back to you soon</p>
            <p className="text-sm text-gray-500 mt-1">We usually reply within a couple of days.</p>
            <button
              onClick={() => setSubmitted(false)}
              className="mt-4 text-sm font-medium text-accent hover:underline"
            >
              Send another message
            </button>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4"
          >
            <ErrorBanner message={error} />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">I am a...</label>
              <Select value={role} onChange={(e) => setRole(e.target.value)} required>
                <option value="" disabled>
                  Select one
                </option>
                {ROLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
              <textarea
                rows={5}
                maxLength={2000}
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-primary text-white py-2 text-sm font-medium hover:bg-primary-dark transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60"
            >
              {submitting ? (
                <span className="inline-flex items-center gap-1.5 justify-center">
                  <Loader2 size={14} className="animate-spin" />
                  Sending…
                </span>
              ) : (
                'Send message'
              )}
            </button>
          </form>
        )}
      </section>
    </div>
  )
}
