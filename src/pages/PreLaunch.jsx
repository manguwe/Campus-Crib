import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft, ArrowRight, Building2, Check, CheckCircle2, ChevronRight,
  CircleHelp, House, Lightbulb, MessageSquare, Search, ShieldCheck,
  Sparkles, Star, Users, X
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { usePlatformMode } from '../context/PlatformModeContext'
import { supabase } from '../lib/supabaseClient'
import { recordReferralEvent } from '../lib/referralTracking'
import { recordReferralInterest } from '../lib/launchReadiness'
import { formatSupabaseError } from '../lib/errorMessages'

const roleOptions = [
  { value: 'student', label: 'Student', icon: Search, description: 'Looking for accommodation' },
  { value: 'landlord', label: 'Landlord', icon: Building2, description: 'Offering accommodation' },
  { value: 'caretaker', label: 'Caretaker', icon: House, description: 'Helping manage accommodation' },
  { value: 'other', label: 'Other', icon: Users, description: 'Connected to the problem' },
]

const roleQuestions = {
  student: [
    'How do you currently find accommodation?',
    'What is most difficult about finding accommodation?',
    'Have you used an accommodation agent before?',
    'What information do you want before choosing a place?',
    'Which Campus Crib features would be useful to you?',
  ],
  landlord: [
    'How do you currently find students for vacant rooms?',
    'What is difficult about advertising or filling rooms?',
    'What information do you need from a prospective tenant?',
    'Which Campus Crib features would help you manage your listings?',
  ],
  caretaker: [
    'How do you currently help students find available rooms?',
    'What is difficult about communicating availability and room details?',
    'What information should students see before contacting you?',
    'Which Campus Crib features would make your work easier?',
  ],
  other: [
    'What is your connection to student accommodation?',
    'What problem around student accommodation have you noticed?',
    'What information should an accommodation platform provide?',
    'Which Campus Crib features would be useful?',
  ],
}

const journeySteps = [
  { title: 'Your role', caption: 'Help us understand your perspective.' },
  { title: 'Your experience', caption: 'Tell us where accommodation gets difficult.' },
  { title: 'Your priorities', caption: 'Tell us what information matters.' },
  { title: 'Your rating', caption: 'Share what you think should happen next.' },
]

export default function PreLaunch() {
  const { user, profile } = useAuth()
  const { mode } = usePlatformMode()
  const [showFeedback, setShowFeedback] = useState(false)
  const [step, setStep] = useState(0)
  const [role, setRole] = useState(profile?.role && roleOptions.some((item) => item.value === profile.role) ? profile.role : '')
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

  const questions = role ? roleQuestions[role] : []
  const progress = useMemo(() => Math.min(100, Math.round(((step + 1) / 4) * 100)), [step])

  if (mode !== 'pre_launch') return null

  function openResearch() {
    recordReferralInterest({ action: 'feedback_cta' }, user?.id || null)
    setShowFeedback(true)
    setStep(role ? 1 : 0)
    setError('')
  }

  function chooseRole(value) {
    setRole(value)
    setAnswers({})
    setError('')
    setStep(1)
  }

  function nextStep() {
    setError('')
    if (step === 0 && !role) return setError('Choose the option that best describes you.')
    if (step === 1) {
      const unanswered = questions.some((question) => !answers[question]?.trim())
      if (unanswered) return setError('Answer the questions above so we can use your experience in our research.')
    }
    if (step === 2 && !suggestion.trim()) return setError('Tell us what information or feature would make Campus Crib useful to you.')
    setStep((current) => Math.min(3, current + 1))
  }

  function previousStep() {
    setError('')
    setStep((current) => Math.max(0, current - 1))
  }

  async function submitFeedback(e) {
    e.preventDefault()
    setError('')
    if (!role) return setError('Choose the option that best describes you.')
    if (!rating) return setError('Please give the idea a rating from 1 to 5.')
    if (suggestion.trim().length < 10) return setError('Please share a little more detail so the feedback is useful.')

    setSubmitting(true)
    const messageParts = [
      `Role: ${role}`,
      `Rating: ${rating}/5`,
      ...questions.map((question) => `${question}\n${answers[question] || 'Not answered'}`),
      `Suggestions / feature requests:\n${suggestion.trim()}`,
    ]

    const { data: feedbackId, error: insertError } = await supabase.rpc('submit_feedback_public', {
      p_name: name.trim() || null,
      p_email: email.trim() || null,
      p_message: messageParts.join('\n\n'),
      p_user_type: role,
      p_rating: rating,
      p_suggestion: suggestion.trim(),
      p_feature_requests: suggestion.trim(),
      p_source: 'pre_launch_research',
    })

    if (insertError) {
      setSubmitting(false)
      setError(formatSupabaseError(insertError, 'We could not save your research response. Please try again.'))
      return
    }

    await recordReferralEvent('feedback_submitted', { source: 'pre_launch_research', feedback_id: feedbackId, user_type: role }, user?.id || null)
    setSubmitting(false)
    setSubmitted(true)
  }

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute -top-28 -left-24 h-72 w-72 rounded-full bg-accent/10 blur-3xl animate-pulse" />
      <div className="pointer-events-none absolute top-40 -right-28 h-80 w-80 rounded-full bg-primary/10 blur-3xl animate-pulse [animation-delay:900ms]" />

      <div className="relative max-w-6xl mx-auto space-y-16">
        <section className="text-center pt-4 sm:pt-10 animate-fade-in-up">
          <div className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-white/80 backdrop-blur text-accent px-4 py-2 text-xs font-bold shadow-sm">
            <Sparkles size={14} className="animate-pulse" /> Campus Crib is preparing to launch
          </div>
          <h1 className="mt-6 text-4xl sm:text-6xl font-black tracking-tight text-primary leading-[1.05] max-w-4xl mx-auto">
            Accommodation should be easier to <span className="text-accent">find, understand and compare.</span>
          </h1>
          <p className="text-base sm:text-lg text-gray-600 mt-6 max-w-2xl mx-auto leading-7">
            We are building Campus Crib around the real accommodation journey — not assumptions. Your experience helps us shape what launches.
          </p>
          <div className="flex flex-wrap justify-center gap-3 mt-8">
            <button onClick={openResearch} className="group inline-flex items-center gap-2 rounded-2xl bg-primary text-white px-6 py-3.5 font-bold shadow-lg shadow-primary/20 transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary-dark">
              Help shape Campus Crib <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
            </button>
            <Link to="/invite" onClick={() => recordReferralInterest({ action: 'invite_cta' }, user?.id || null)} className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-white/90 text-primary px-6 py-3.5 font-bold shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/40">
              Invite someone <Users size={18} />
            </Link>
          </div>
        </section>

        <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            [Search, 'Discover', 'Explore accommodation with clearer information.'],
            [ShieldCheck, 'Compare', 'See useful details before making contact.'],
            [Building2, 'Connect', 'Create a clearer channel between students and providers.'],
            [Lightbulb, 'Improve', 'Turn real experiences into better product decisions.'],
          ].map(([Icon, title, text], index) => (
            <div key={title} className="group rounded-3xl border border-white/70 bg-white/80 backdrop-blur p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/5 animate-fade-in-up" style={{ animationDelay: `${index * 80}ms` }}>
              <div className="h-11 w-11 rounded-2xl bg-accent/10 text-accent flex items-center justify-center transition-transform duration-300 group-hover:rotate-6 group-hover:scale-110">
                <Icon size={21} />
              </div>
              <h2 className="font-bold text-primary mt-5">{title}</h2>
              <p className="text-sm text-gray-500 mt-1.5 leading-6">{text}</p>
            </div>
          ))}
        </section>

        <section className="relative overflow-hidden rounded-[2rem] bg-primary text-white p-8 sm:p-11 shadow-2xl shadow-primary/15">
          <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-accent/20 blur-2xl" />
          <div className="relative">
            <div className="flex items-center gap-2 text-accent text-xs font-bold uppercase tracking-[0.18em]"><House size={15} /> Built around real accommodation needs</div>
            <h2 className="text-2xl sm:text-3xl font-black mt-3 max-w-3xl">One platform, different people, one accommodation problem.</h2>
            <div className="grid sm:grid-cols-3 gap-4 mt-8">
              {roleOptions.slice(0, 3).map(({ icon: Icon, label, description }) => (
                <div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-5 hover:bg-white/10 transition-colors">
                  <Icon size={20} className="text-accent" />
                  <strong className="block mt-4">{label}s</strong>
                  <span className="text-sm text-white/65 leading-6">{description}.</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-gray-200 bg-white p-8 sm:p-10 shadow-sm text-center">
          <CheckCircle2 className="mx-auto text-accent" size={30} />
          <h2 className="text-2xl sm:text-3xl font-black text-primary mt-4">We are validating the problem before scaling the marketplace.</h2>
          <p className="text-gray-500 max-w-2xl mx-auto mt-3 leading-7">Your answers help us understand the real accommodation journey, the information people need, and what should be prioritised before launch.</p>
        </section>
      </div>

      {showFeedback && (
        <div className="fixed inset-0 z-50 bg-primary/50 backdrop-blur-sm p-3 sm:p-6 flex items-center justify-center animate-fade-in-up" role="dialog" aria-modal="true" aria-labelledby="research-title">
          <div className="bg-white w-full max-w-3xl max-h-[94vh] overflow-y-auto rounded-[2rem] shadow-2xl border border-white/70">
            <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-gray-100 px-5 sm:px-8 pt-5 sm:pt-7 pb-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-2 text-accent text-xs font-black uppercase tracking-[0.16em]"><CircleHelp size={14} /> Pre-launch research</div>
                  <h2 id="research-title" className="text-2xl sm:text-3xl font-black text-primary mt-2">Help us understand the accommodation problem.</h2>
                  <p className="text-sm text-gray-500 mt-2">This is research, not a popularity poll. There are no wrong answers.</p>
                </div>
                <button onClick={() => setShowFeedback(false)} className="shrink-0 rounded-xl p-2 text-gray-400 hover:bg-gray-100 hover:text-primary transition-colors" aria-label="Close research form"><X size={20} /></button>
              </div>
              {!submitted && (
                <div className="mt-5">
                  <div className="flex items-center justify-between text-xs font-semibold text-gray-500 mb-2"><span>Step {step + 1} of 4</span><span>{progress}%</span></div>
                  <div className="h-2 rounded-full bg-gray-100 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-500" style={{ width: `${progress}%` }} /></div>
                  <div className="grid grid-cols-4 gap-2 mt-3">
                    {journeySteps.map((item, index) => <div key={item.title} className={`text-[11px] sm:text-xs ${index <= step ? 'text-primary font-bold' : 'text-gray-400'}`}>{item.title}</div>)}
                  </div>
                </div>
              )}
            </div>

            {submitted ? (
              <div className="p-8 sm:p-12 text-center">
                <div className="mx-auto h-16 w-16 rounded-full bg-accent/10 text-accent flex items-center justify-center animate-bounce"><Check size={30} /></div>
                <h3 className="text-2xl font-black text-primary mt-6">Thank you. This is useful.</h3>
                <p className="text-gray-500 max-w-md mx-auto mt-2 leading-6">Your research response has been added to the existing Campus Crib feedback workflow for review.</p>
                <button onClick={() => { setSubmitted(false); setShowFeedback(false); setStep(0) }} className="mt-7 rounded-xl bg-primary text-white px-6 py-3 font-bold hover:bg-primary-dark transition-colors">Continue exploring</button>
              </div>
            ) : (
              <form onSubmit={submitFeedback} className="p-5 sm:p-8">
                {error && <div className="mb-5 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><X size={17} className="mt-0.5 shrink-0" /><span>{error}</span></div>}

                {step === 0 && (
                  <div className="space-y-5 animate-fade-in-up">
                    <div><p className="text-sm font-bold text-primary">Which best describes you?</p><p className="text-xs text-gray-500 mt-1">Choose the perspective you want us to learn from.</p></div>
                    <div className="grid sm:grid-cols-2 gap-3">
                      {roleOptions.map(({ value, label, icon: Icon, description }) => {
                        const selected = role === value
                        return <button key={value} type="button" onClick={() => chooseRole(value)} className={`group text-left rounded-2xl border p-4 transition-all duration-200 ${selected ? 'border-accent bg-accent/5 ring-2 ring-accent/15 shadow-sm' : 'border-gray-200 bg-white hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-md'}`}>
                          <div className="flex items-center gap-3"><div className={`h-11 w-11 rounded-xl flex items-center justify-center ${selected ? 'bg-accent text-white' : 'bg-gray-100 text-primary group-hover:bg-accent/10 group-hover:text-accent'}`}><Icon size={20} /></div><div className="min-w-0"><div className="font-bold text-primary">{label}</div><div className="text-xs text-gray-500 mt-0.5">{description}</div></div><ChevronRight size={18} className={`ml-auto ${selected ? 'text-accent' : 'text-gray-300'}`} /></div>
                        </button>
                      })}
                    </div>
                  </div>
                )}

                {step === 1 && (
                  <div className="space-y-5 animate-fade-in-up">
                    {questions.map((question, index) => <div key={question} className="rounded-2xl border border-gray-200 bg-gray-50/70 p-4 sm:p-5"><label className="block text-sm font-bold text-primary"><span className="text-accent mr-2">0{index + 1}</span>{question}</label><textarea value={answers[question] || ''} onChange={(e) => setAnswers((current) => ({ ...current, [question]: e.target.value }))} rows={3} className="mt-3 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-3 text-sm text-ink placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent" placeholder="Share your experience…" /></div>)}
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-5 animate-fade-in-up">
                    <div className="rounded-3xl bg-gradient-to-br from-primary to-primary-dark p-6 sm:p-8 text-white"><Lightbulb className="text-accent" size={25} /><h3 className="text-xl font-black mt-4">What would make Campus Crib genuinely useful?</h3><p className="text-sm text-white/70 mt-2">Think about information, tools, trust, communication, or anything missing from the current accommodation journey.</p></div>
                    <textarea value={suggestion} onChange={(e) => setSuggestion(e.target.value)} rows={7} className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-4 text-sm text-ink placeholder:text-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent" placeholder="Your suggestion, feature request, or biggest concern…" />
                    <div className="grid sm:grid-cols-2 gap-3"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (optional)" className="rounded-xl border border-gray-200 px-3.5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent" /><input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Email (optional)" className="rounded-xl border border-gray-200 px-3.5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent" /></div>
                  </div>
                )}

                {step === 3 && (
                  <div className="text-center animate-fade-in-up">
                    <div className="mx-auto h-14 w-14 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center"><Star size={26} fill="currentColor" /></div>
                    <h3 className="text-2xl font-black text-primary mt-5">How useful does the idea feel?</h3>
                    <p className="text-sm text-gray-500 mt-2">Rate the concept based on your own accommodation needs.</p>
                    <div className="flex justify-center gap-2 sm:gap-3 mt-8" role="radiogroup" aria-label="Rate Campus Crib from 1 to 5">
                      {[1, 2, 3, 4, 5].map((value) => <button key={value} type="button" onClick={() => setRating(value)} className={`h-12 w-12 sm:h-14 sm:w-14 rounded-2xl border transition-all duration-200 ${rating >= value ? 'bg-amber-400 border-amber-400 text-white scale-105 shadow-lg shadow-amber-400/20' : 'bg-white border-gray-200 text-gray-300 hover:border-amber-300 hover:text-amber-400'}`} aria-label={`${value} out of 5`}><Star size={21} fill={rating >= value ? 'currentColor' : 'none'} className="mx-auto" /></button>)}
                    </div>
                    <p className="mt-4 text-sm font-bold text-primary">{rating ? `${rating} out of 5` : 'Select a rating'}</p>
                  </div>
                )}

                <div className="mt-8 flex items-center justify-between gap-3 border-t border-gray-100 pt-5">
                  <button type="button" onClick={step === 0 ? () => setShowFeedback(false) : previousStep} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors"><ArrowLeft size={16} /> {step === 0 ? 'Maybe later' : 'Back'}</button>
                  {step < 3 ? <button type="button" onClick={nextStep} className="inline-flex items-center gap-2 rounded-xl bg-primary text-white px-5 py-2.5 text-sm font-bold hover:bg-primary-dark transition-colors">Continue <ArrowRight size={16} /></button> : <button type="submit" disabled={submitting} className="inline-flex items-center gap-2 rounded-xl bg-accent text-white px-5 py-2.5 text-sm font-bold hover:bg-accent-dark transition-colors disabled:opacity-60">{submitting ? 'Saving…' : 'Submit research'} <Check size={16} /></button>}
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
