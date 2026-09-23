import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Building2, CheckCircle2, MessageSquare, Search, ShieldCheck, Sparkles, Users, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { usePlatformMode } from '../context/PlatformModeContext'
import { supabase } from '../lib/supabaseClient'
import { recordReferralEvent } from '../lib/referralTracking'
import { recordReferralInterest } from '../lib/launchReadiness'

const roleOptions = ['student', 'landlord', 'caretaker', 'other']

const roleQuestions = {
  student: [
    ['How do you currently find accommodation?', 'How do you currently find accommodation?'],
    ['What is most difficult about finding accommodation?', 'What is most difficult about finding accommodation?'],
    ['Have you used an accommodation agent before?', 'Have you used an accommodation agent before?'],
    ['What information do you want before choosing a place?', 'What information do you want before choosing a place?'],
    ['Which Campus Crib features would be useful to you?', 'Which Campus Crib features would be useful to you?'],
  ],
  landlord: [
    ['How do you currently find students for vacant rooms?', 'How do you currently find students for vacant rooms?'],
    ['What is difficult about advertising or filling rooms?', 'What is difficult about advertising or filling rooms?'],
    ['What information do you need from a prospective tenant?', 'What information do you need from a prospective tenant?'],
    ['Which Campus Crib features would help you manage your listings?', 'Which Campus Crib features would help you manage your listings?'],
  ],
  caretaker: [
    ['How do you currently help students find available rooms?', 'How do you currently help students find available rooms?'],
    ['What is difficult about communicating availability and room details?', 'What is difficult about communicating availability and room details?'],
    ['What information should students see before contacting you?', 'What information should students see before contacting you?'],
    ['Which Campus Crib features would make your work easier?', 'Which Campus Crib features would make your work easier?'],
  ],
  other: [
    ['What is your connection to student accommodation?', 'What is your connection to student accommodation?'],
    ['What problem around student accommodation have you noticed?', 'What problem around student accommodation have you noticed?'],
    ['What information should an accommodation platform provide?', 'What information should an accommodation platform provide?'],
    ['Which Campus Crib features would be useful?', 'Which Campus Crib features would be useful?'],
  ],
}

export default function PreLaunch() {
  const { user, profile } = useAuth()
  const { mode } = usePlatformMode()
  const [showFeedback, setShowFeedback] = useState(false)
  const [role, setRole] = useState(profile?.role && roleOptions.includes(profile.role) ? profile.role : '')
  const [answers, setAnswers] = useState({})
  const [rating, setRating] = useState(0)
  const [suggestion, setSuggestion] = useState('')
  const [email, setEmail] = useState(user?.email || '')
  const [name, setName] = useState(profile?.name || '')
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => setShowFeedback(true), 45000)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    function onMouseLeave(event) {
      if (event.clientY <= 0 && !submitted && !sessionStorage.getItem('cc_exit_prompt_seen')) {
        sessionStorage.setItem('cc_exit_prompt_seen', '1')
        setShowFeedback(true)
      }
    }
    document.addEventListener('mouseleave', onMouseLeave)
    return () => document.removeEventListener('mouseleave', onMouseLeave)
  }, [submitted])

  if (mode !== 'pre_launch') return null

  const questions = role ? roleQuestions[role] : []

  async function submitFeedback(e) {
    e.preventDefault()
    setError('')
    if (!role) return setError('Please choose the option that best describes you.')
    if (!rating) return setError('Please give the idea a rating from 1 to 5.')
    if (suggestion.trim().length < 10) return setError('Please share a little more detail so the feedback is useful.')

    setSubmitting(true)
    const messageParts = [
      `Role: ${role}`,
      `Rating: ${rating}/5`,
      ...questions.map(([key]) => `${key}\n${answers[key] || 'Not answered'}`),
      `Suggestions / feature requests:\n${suggestion.trim()}`,
    ]

    const { data, error: insertError } = await supabase.from('feedback').insert({
      submitted_by: user?.id || null,
      name: name.trim() || null,
      email: email.trim() || null,
      message: messageParts.join('\n\n'),
      user_type: role,
      rating,
      suggestion: suggestion.trim(),
      feature_requests: suggestion.trim(),
      source: 'pre_launch_research',
    }).select('id').single()

    if (insertError) {
      setSubmitting(false)
      setError(insertError.message || 'Could not submit feedback.')
      return
    }

    await recordReferralEvent('feedback_submitted', { source: 'pre_launch_research', feedback_id: data?.id, user_type: role }, user?.id || null)
    setSubmitting(false)
    setSubmitted(true)
  }

  return (
    <div className="max-w-6xl mx-auto space-y-16">
      <section className="text-center pt-4 sm:pt-10">
        <div className="inline-flex items-center gap-2 rounded-full bg-accent/10 text-accent px-3 py-1 text-xs font-semibold mb-5">
          <Sparkles size={14} /> Campus Crib is preparing to launch
        </div>
        <h1 className="text-4xl sm:text-6xl font-bold text-primary leading-tight max-w-4xl mx-auto">
          Finding student accommodation should not feel like guesswork.
        </h1>
        <p className="text-lg text-gray-600 mt-5 max-w-2xl mx-auto">
          Campus Crib is being built to make it easier to discover accommodation, compare useful details, and connect with the people responsible for available spaces.
        </p>
        <div className="flex flex-wrap justify-center gap-3 mt-8">
          <button onClick={() => { recordReferralInterest({ action: 'feedback_cta' }, user?.id || null); setShowFeedback(true) }} className="inline-flex items-center gap-2 rounded-xl bg-primary text-white px-5 py-3 font-semibold hover:bg-primary-dark">
            Help shape Campus Crib <ArrowRight size={17} />
          </button>
          <Link to="/invite" onClick={() => recordReferralInterest({ action: 'invite_cta' }, user?.id || null)} className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white text-primary px-5 py-3 font-semibold hover:bg-gray-50">
            Invite someone <Users size={17} />
          </Link>
        </div>
      </section>

      <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          [Search, 'Discover', 'Explore accommodation with clearer information.'],
          [ShieldCheck, 'Compare', 'See useful details before making contact.'],
          [Building2, 'Connect', 'Give students and accommodation providers a direct channel.'],
          [MessageSquare, 'Improve', 'Use real feedback to shape the platform before launch.'],
        ].map(([Icon, title, text]) => (
          <div key={title} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <Icon className="text-accent" size={22} />
            <h2 className="font-semibold text-primary mt-4">{title}</h2>
            <p className="text-sm text-gray-500 mt-1">{text}</p>
          </div>
        ))}
      </section>

      <section className="bg-primary text-white rounded-3xl p-7 sm:p-10">
        <h2 className="text-2xl sm:text-3xl font-bold">Built for the people who actually use accommodation services.</h2>
        <div className="grid sm:grid-cols-3 gap-6 mt-7 text-sm text-white/80">
          <div><strong className="text-white block">Students</strong>Find places, understand the details, and contact providers.</div>
          <div><strong className="text-white block">Landlords</strong>Present available accommodation and manage listing information.</div>
          <div><strong className="text-white block">Caretakers</strong>Communicate availability and practical accommodation details.</div>
        </div>
      </section>

      <section className="text-center pb-8">
        <CheckCircle2 className="mx-auto text-accent" size={28} />
        <h2 className="text-2xl font-bold text-primary mt-3">We are validating the problem before scaling the marketplace.</h2>
        <p className="text-gray-500 max-w-2xl mx-auto mt-2">Your answers help us understand the real accommodation journey, what information is missing, and what should be prioritised.</p>
      </section>

      {showFeedback && !submitted && (
        <div className="fixed inset-0 z-50 bg-black/40 p-4 flex items-center justify-center" role="dialog" aria-modal="true">
          <div className="bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-xl p-5 sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-accent uppercase tracking-wide">Before you go</p>
                <h2 className="text-2xl font-bold text-primary mt-1">Help us build the right thing.</h2>
                <p className="text-sm text-gray-500 mt-1">This is research, not a popularity poll. Tell us about the accommodation problem.</p>
              </div>
              <button onClick={() => setShowFeedback(false)} className="p-2 text-gray-400 hover:text-gray-700" aria-label="Close"><X size={20} /></button>
            </div>

            <form onSubmit={submitFeedback} className="space-y-5 mt-6">
              {error && <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm p-3">{error}</div>}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Which best describes you?</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {roleOptions.map((option) => (
                    <button key={option} type="button" onClick={() => { setRole(option); setAnswers({}) }} className={`rounded-lg border px-3 py-2 text-sm capitalize ${role === option ? 'border-accent bg-accent/10 text-accent font-semibold' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>{option}</button>
                  ))}
                </div>
              </div>

              {role && questions.map(([key, label]) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                  <textarea rows={2} value={answers[key] || ''} onChange={(e) => setAnswers((prev) => ({ ...prev, [key]: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
                </div>
              ))}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">How useful does the Campus Crib idea seem to you? <span className="text-gray-400">(1–5)</span></label>
                <div className="flex gap-2">{[1,2,3,4,5].map((n) => <button key={n} type="button" onClick={() => setRating(n)} className={`w-10 h-10 rounded-full border font-semibold ${rating === n ? 'bg-primary text-white border-primary' : 'border-gray-300 text-gray-600'}`}>{n}</button>)}</div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Suggestions or feature requests</label>
                <textarea rows={4} value={suggestion} onChange={(e) => setSuggestion(e.target.value)} maxLength={3000} placeholder="What should we understand, fix, or add?" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (optional)" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email (optional)" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              </div>

              <button disabled={submitting} className="w-full rounded-xl bg-primary text-white py-3 font-semibold disabled:opacity-60">{submitting ? 'Sending…' : 'Submit research feedback'}</button>
            </form>
          </div>
        </div>
      )}

      {submitted && (
        <div className="fixed inset-0 z-50 bg-black/40 p-4 flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-xl max-w-md p-8 text-center">
            <CheckCircle2 className="mx-auto text-accent" size={38} />
            <h2 className="text-xl font-bold text-primary mt-3">Thank you.</h2>
            <p className="text-sm text-gray-500 mt-2">Your research feedback has been added to the existing Campus Crib feedback workflow.</p>
            <button onClick={() => { setSubmitted(false); setShowFeedback(false) }} className="mt-5 rounded-lg bg-primary text-white px-5 py-2 text-sm font-semibold">Continue</button>
          </div>
        </div>
      )}
    </div>
  )
}
