import { useEffect, useMemo, useState } from 'react'
import { Copy, MessageCircle, GraduationCap, Home, KeyRound, Users, Loader2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { buildReferralUrl, getMyReferralSource, recordInviteCreated } from '../lib/referralInvitations'

const TARGETS = [
  { id: 'student', label: 'Invite a Student', description: 'Help another student discover Campus Crib.', icon: GraduationCap },
  { id: 'landlord', label: 'Invite a Landlord', description: 'Bring an accommodation provider onto the platform.', icon: Home },
  { id: 'caretaker', label: 'Invite a Caretaker', description: 'Invite someone who manages properties for landlords.', icon: KeyRound },
  { id: 'friend', label: 'Invite a Friend', description: 'Share Campus Crib with someone you know.', icon: Users },
]

export default function Invite() {
  const { user, profile } = useAuth()
  const [source, setSource] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [selected, setSelected] = useState('student')

  useEffect(() => {
    let mounted = true
    if (!user) return
    getMyReferralSource()
      .then(data => { if (mounted) setSource(data) })
      .catch(err => { if (mounted) setError(err.message || 'Could not create your referral link.') })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [user])

  const url = useMemo(() => buildReferralUrl(source?.code), [source?.code])

  async function copyLink() {
    if (!url) return
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  async function share() {
    if (!url) return
    await recordInviteCreated(selected)
    const target = TARGETS.find(t => t.id === selected)
    const text = `Check out Campus Crib — a platform for discovering student accommodation. ${url}`
    if (navigator.share) {
      await navigator.share({ title: 'Campus Crib', text: `${target?.label}: ${text}`, url })
    } else {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    }
  }

  if (!user) return <div className="max-w-lg mx-auto text-center py-12"><h1 className="text-2xl font-bold text-primary">Sign in to invite people</h1><p className="text-gray-500 mt-2">Your personal referral link is connected to your Campus Crib account.</p></div>
  if (loading) return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-primary" /></div>

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-7">
        <p className="text-sm font-semibold text-accent">CAMPUS CRIB REFERRALS</p>
        <h1 className="text-3xl font-bold text-primary mt-1">Invite people to Campus Crib</h1>
        <p className="text-gray-500 mt-2">Choose who you want to invite, then share your personal Campus Crib link. Referral tracking stays active after launch.</p>
      </div>

      {error && <div className="mb-5 rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">{error}</div>}

      <div className="grid sm:grid-cols-2 gap-3 mb-6">
        {TARGETS.map(({ id, label, description, icon: Icon }) => (
          <button key={id} type="button" onClick={() => setSelected(id)} className={`text-left rounded-xl border p-4 transition ${selected === id ? 'border-accent bg-accent/5 ring-2 ring-accent/20' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
            <Icon size={22} className="text-primary mb-3" />
            <p className="font-semibold text-gray-900">{label}</p>
            <p className="text-xs text-gray-500 mt-1">{description}</p>
          </button>
        ))}
      </div>

      {source && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <p className="text-sm text-gray-500">Your referral code</p>
          <p className="font-mono text-xl font-bold text-primary mt-1">{source.code}</p>
          <div className="mt-4 flex gap-2">
            <input readOnly value={url} className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm bg-gray-50" />
            <button onClick={copyLink} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50"><Copy size={15} />{copied ? 'Copied' : 'Copy'}</button>
          </div>
          <button onClick={share} className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary text-white py-2.5 text-sm font-medium hover:bg-primary-dark"><MessageCircle size={16} /> Share invitation</button>
          <p className="text-xs text-gray-400 mt-3">Signed in as {profile?.name || user.email}. No cash rewards are activated by this system.</p>
        </div>
      )}
    </div>
  )
}
