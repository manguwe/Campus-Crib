import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Headphones, MessageCircle, Mic, MicOff, Phone, PhoneCall, PhoneOff, Send, ShieldCheck, UserRound, Volume2, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { loadConversations, loadMessages, sendMessage, startListingChat, startSupportChat, startVoiceCall, sendCallSignal, updateCall, getCallContact, getVoiceCallIdentity, loadCallSignals } from '../lib/chat'
import Spinner from '../components/ui/Spinner'

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]

function formatTime(value) {
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function Messages() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [conversations, setConversations] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [error, setError] = useState('')
  const [startingChat, setStartingChat] = useState(false)
  const [call, setCall] = useState(null)
  const [incomingCall, setIncomingCall] = useState(null)
  const [incomingCaller, setIncomingCaller] = useState(null)
  const [callError, setCallError] = useState('')
  const [callContact, setCallContact] = useState(null)
  const [isMuted, setIsMuted] = useState(false)
  const pendingIceRef = useRef([])

  const selected = conversations.find((c) => c.id === selectedId) || null
  const otherMember = useMemo(() => selected?.members?.find((m) => m.user_id !== user?.id)?.profiles || null, [selected, user?.id])
  const messagesEndRef = useRef(null)
  const callRef = useRef(null)
  const remoteAudioRef = useRef(null)

  async function refreshConversations(selectId = null) {
    if (!user?.id) return
    const rows = await loadConversations(user.id)
    setConversations(rows)
    const requested = selectId || searchParams.get('conversation')
    setSelectedId(requested && rows.some((r) => r.id === requested) ? requested : (rows[0]?.id || null))
  }

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        await refreshConversations()
      } catch (e) {
        if (active) setError(e.message || 'Could not load your messages.')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [user?.id])

  useEffect(() => {
    if (!selectedId) { setMessages([]); return undefined }
    let active = true
    ;(async () => {
      setMessagesLoading(true)
      try {
        const rows = await loadMessages(selectedId)
        if (active) setMessages(rows)
      } catch (e) {
        if (active) setError(e.message || 'Could not load messages.')
      } finally {
        if (active) setMessagesLoading(false)
      }
    })()

    const channel = supabase
      .channel(`chat:${selectedId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${selectedId}` }, (payload) => {
        if (active) setMessages((prev) => prev.some((m) => m.id === payload.new.id) ? prev : [...prev, payload.new])
      })
      .subscribe()

    return () => { active = false; supabase.removeChannel(channel) }
  }, [selectedId])

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  // Recover a ringing call if the user opened the app from a notification
  // after the original realtime INSERT happened.
  useEffect(() => {
    if (!user?.id) return undefined
    ;(async () => {
      const { data } = await supabase.from('voice_calls').select('*').eq('callee_id', user.id).eq('status', 'ringing').order('created_at', { ascending: false }).limit(1)
      if (data?.[0]) {
        setIncomingCall(data[0])
        try { setIncomingCaller(await getVoiceCallIdentity(data[0].id)) } catch {}
      }
    })()
  }, [user?.id])

  // Incoming calls are listened for globally while Messages is open.
  useEffect(() => {
    if (!user?.id) return undefined
    const channel = supabase
      .channel(`incoming-calls:${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'voice_calls', filter: `callee_id=eq.${user.id}` }, async (payload) => {
        setIncomingCall(payload.new)
        try { setIncomingCaller(await getVoiceCallIdentity(payload.new.id)) } catch { setIncomingCaller(null) }
        try { await refreshConversations(payload.new.conversation_id) } catch {}
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [user?.id])

  async function ensureChatForListing() {
    const propertyId = searchParams.get('property')
    if (!propertyId || startingChat) return
    setStartingChat(true); setError('')
    try {
      const id = await startListingChat(propertyId)
      await refreshConversations(id)
    } catch (e) {
      setError(e.message || 'You need approved access to start a landlord chat.')
    } finally { setStartingChat(false) }
  }

  useEffect(() => { ensureChatForListing() }, [searchParams.toString(), user?.id])

  async function send() {
    if (!selectedId || !user?.id || !draft.trim()) return
    const text = draft
    setDraft('')
    try {
      const row = await sendMessage(selectedId, user.id, text)
      setMessages((prev) => prev.some((m) => m.id === row.id) ? prev : [...prev, row])
    } catch (e) {
      setDraft(text)
      setError(e.message || 'Message could not be sent.')
    }
  }

  function closeCallResources() {
    const active = callRef.current
    if (active?.pc) active.pc.close()
    active?.stream?.getTracks?.().forEach((track) => track.stop())
    if (active?.signalChannel) supabase.removeChannel(active.signalChannel)
    callRef.current = null
    pendingIceRef.current = []
    setIsMuted(false)
  }

  async function applyPendingIce(pc) {
    const queued = pendingIceRef.current.splice(0)
    for (const candidate of queued) {
      try { await pc.addIceCandidate(candidate) } catch {}
    }
  }

  async function beginCall(targetCall, isCaller) {
    setCallError('')
    pendingIceRef.current = []
    try {
      if (!window.RTCPeerConnection || !navigator.mediaDevices?.getUserMedia) {
        throw new Error('Voice calling is not supported by this browser.')
      }
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      stream.getTracks().forEach((track) => { track.enabled = !isMuted; pc.addTrack(track, stream) })
      pc.ontrack = (event) => {
        const audio = remoteAudioRef.current
        if (!audio) return
        audio.srcObject = event.streams[0]
        audio.volume = 1
        audio.muted = false
        const playPromise = audio.play()
        if (playPromise?.catch) playPromise.catch(() => setCallError('Your browser blocked the remote audio. Tap the call panel to enable speaker audio.'))
      }
      pc.onicecandidate = async (event) => {
        if (event.candidate) {
          try { await sendCallSignal(targetCall.id, user.id, 'ice-candidate', event.candidate.toJSON()) } catch {}
        }
      }
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed') setCallError('The voice connection failed. Check both users have microphone permission and a stable internet connection.')
      }
      callRef.current = { pc, stream }
      setCall(targetCall)

      const signalChannel = supabase
        .channel(`call-signals:${targetCall.id}:${user.id}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'voice_call_signals', filter: `call_id=eq.${targetCall.id}` }, async (payload) => {
          if (payload.new.sender_id === user.id) return
          await handleCallSignal(pc, targetCall, isCaller, payload.new)
        })
        .subscribe()
      callRef.current.signalChannel = signalChannel

      // Re-read signals after subscribing. This closes the race where the
      // caller's offer was written before the callee's realtime subscription was ready.
      const existingSignals = await loadCallSignals(targetCall.id)
      for (const signal of existingSignals) {
        if (signal.sender_id !== user.id) await handleCallSignal(pc, targetCall, isCaller, signal)
      }

      if (isCaller) {
        const offer = await pc.createOffer({ offerToReceiveAudio: true })
        await pc.setLocalDescription(offer)
        await sendCallSignal(targetCall.id, user.id, 'offer', offer)
      }
    } catch (e) {
      closeCallResources()
      setCall(null)
      setCallError(e.name === 'NotAllowedError' ? 'Microphone permission was denied. Allow microphone access in your browser settings.' : (e.message || 'Could not start the voice call.'))
    }
  }

  async function handleCallSignal(pc, targetCall, isCaller, signal) {
    try {
      if (signal.signal_type === 'offer' && !isCaller) {
        if (!pc.currentRemoteDescription) {
          await pc.setRemoteDescription(signal.payload)
          await applyPendingIce(pc)
          const answer = await pc.createAnswer({ offerToReceiveAudio: true })
          await pc.setLocalDescription(answer)
          await sendCallSignal(targetCall.id, user.id, 'answer', answer)
          await updateCall(targetCall.id, 'active')
        }
      } else if (signal.signal_type === 'answer' && isCaller) {
        if (!pc.currentRemoteDescription) {
          await pc.setRemoteDescription(signal.payload)
          await applyPendingIce(pc)
          await updateCall(targetCall.id, 'active')
        }
      } else if (signal.signal_type === 'ice-candidate' && signal.payload) {
        if (pc.remoteDescription) {
          await pc.addIceCandidate(signal.payload)
        } else {
          pendingIceRef.current.push(signal.payload)
        }
      } else if (signal.signal_type === 'hangup') {
        await updateCall(targetCall.id, 'ended')
        closeCallResources()
        setCall(null)
      }
    } catch (e) {
      setCallError(e.message || 'Voice connection failed.')
    }
  }

  async function callOther() {
    if (!selected || !otherMember?.id || !user?.id || call) return
    try {
      const contact = await getCallContact(selected.id, otherMember.id)
      setCallContact(contact)
      const newCall = await startVoiceCall(selected.id, user.id, otherMember.id)
      await beginCall(newCall, true)
    } catch (e) { setCallError(e.message || 'Could not start the call.') }
  }

  function toggleMute() {
    const stream = callRef.current?.stream
    if (!stream) return
    const next = !isMuted
    stream.getAudioTracks().forEach((track) => { track.enabled = !next })
    setIsMuted(next)
  }

  function openFallbackPhone() {
    if (callContact?.phone) window.location.href = `tel:${callContact.phone}`
  }

  async function answerIncoming() {
    const incoming = incomingCall
    setIncomingCall(null)
    setIncomingCaller(null)
    if (!incoming) return
    try { setCallContact(await getCallContact(incoming.conversation_id, incoming.caller_id)) } catch { setCallContact(null) }
    await beginCall(incoming, false)
  }

  async function declineIncoming() {
    if (!incomingCall) return
    try { await updateCall(incomingCall.id, 'declined') } catch {}
    setIncomingCall(null)
    setIncomingCaller(null)
    setCallContact(null)
  }

  async function endCall(status = 'ended') {
    const active = callRef.current
    const currentCall = call
    if (active?.signalChannel) await supabase.removeChannel(active.signalChannel)
    if (currentCall) {
      try { await sendCallSignal(currentCall.id, user.id, 'hangup', null) } catch {}
      try { await updateCall(currentCall.id, status) } catch {}
    }
    closeCallResources()
    setCall(null)
    setCallContact(null)
  }

  if (loading) return <div className="max-w-6xl mx-auto px-4 py-16"><Spinner label="Loading messages…" /></div>

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 animate-fade-in-up">
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-xs font-bold tracking-[0.18em] uppercase text-accent">Campus Crib communications</p>
          <h1 className="text-2xl font-bold text-primary mt-1">Messages & calls</h1>
          <p className="text-sm text-gray-500 mt-1">Chat privately with a landlord or Campus Crib support. Voice calls stay inside the app.</p>
        </div>
        <button onClick={() => navigate(-1)} className="hidden sm:inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white text-gray-700"><ArrowLeft size={16}/> Back</button>
      </div>

      {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {callError && <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{callError}</div>}

      <div className="grid lg:grid-cols-[320px_1fr] min-h-[620px] rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <aside className="border-b lg:border-b-0 lg:border-r border-gray-200 bg-gray-50/70">
          <div className="p-4 border-b border-gray-200">
            <button onClick={async () => { setError(''); try { const id = await startSupportChat(); await refreshConversations(id) } catch (e) { setError(e.message || 'Support chat is unavailable.') } }} className="w-full inline-flex justify-center items-center gap-2 rounded-xl bg-primary text-white px-4 py-2.5 text-sm font-bold hover:bg-primary-dark transition"><Headphones size={17}/> Chat with Campus Crib support</button>
          </div>
          <div className="max-h-[520px] overflow-y-auto">
            {conversations.length === 0 ? <div className="p-6 text-center text-sm text-gray-400">No conversations yet.<br/>Open a listing after contact access is approved, or start a support chat.</div> : conversations.map((c) => {
              const person = c.members?.find((m) => m.user_id !== user.id)?.profiles
              return <button key={c.id} onClick={() => setSelectedId(c.id)} className={`w-full text-left p-4 border-b border-gray-100 transition ${selectedId === c.id ? 'bg-white border-l-4 border-l-accent' : 'hover:bg-white'}`}>
                <div className="flex items-center gap-3"><div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary"><UserRound size={18}/></div><div className="min-w-0"><p className="font-semibold text-gray-900 truncate">{c.kind === 'support' ? `Campus Crib Support${person?.name ? ` · ${person.name}` : ''}` : (person?.name || 'Landlord')}</p><p className="text-xs text-gray-500">{c.kind === 'support' ? 'Support & directions' : 'Property chat'}</p></div></div>
              </button>
            })}
          </div>
        </aside>

        <section className="flex flex-col min-w-0">
          {!selected ? <div className="flex-1 flex items-center justify-center p-8 text-center"><div><MessageCircle size={44} className="mx-auto text-accent/60"/><h2 className="mt-3 text-lg font-bold text-primary">Your conversations</h2><p className="mt-1 text-sm text-gray-500 max-w-sm">Select a conversation to send messages, ask for directions, or start a voice call.</p></div></div> : <>
            <header className="px-5 py-4 border-b border-gray-200 flex items-center justify-between gap-3"><div><p className="font-bold text-primary">{selected.kind === 'support' ? `Campus Crib Support${otherMember?.name ? ` · ${otherMember.name}` : ''}` : (otherMember?.name || 'Landlord')}</p><p className="text-xs text-gray-500">{selected.kind === 'support' ? 'Directions, account and platform help' : 'Private listing conversation'}</p></div><button onClick={callOther} disabled={!otherMember?.id || Boolean(call)} className="inline-flex items-center gap-2 rounded-xl bg-accent px-3 py-2 text-sm font-bold text-white disabled:opacity-40 hover:scale-[1.02] transition"><PhoneCall size={16}/> Call {otherMember?.name || 'person'}</button></header>
            <div className="flex-1 p-5 overflow-y-auto bg-gradient-to-b from-white to-gray-50/80">
              {messagesLoading ? <Spinner label="Loading conversation…"/> : messages.length === 0 ? <div className="h-full min-h-[300px] flex items-center justify-center text-center text-sm text-gray-400"><div><ShieldCheck className="mx-auto text-accent"/><p className="mt-2">This is a private conversation.</p><p>Ask for directions or coordinate your visit here.</p></div></div> : messages.map((m) => <div key={m.id} className={`mb-3 flex ${m.sender_id === user.id ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[78%] rounded-2xl px-4 py-2.5 shadow-sm ${m.sender_id === user.id ? 'bg-primary text-white rounded-br-md' : 'bg-white border border-gray-200 text-gray-800 rounded-bl-md'}`}><p className="text-sm whitespace-pre-wrap break-words">{m.body}</p><p className={`text-[10px] mt-1 ${m.sender_id === user.id ? 'text-white/70' : 'text-gray-400'}`}>{formatTime(m.created_at)}</p></div></div>)}
              <div ref={messagesEndRef}/>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); send() }} className="p-4 border-t border-gray-200 flex gap-2"><input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Write a message…" className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"/><button disabled={!draft.trim()} className="rounded-xl bg-primary text-white px-4 py-3 disabled:opacity-40"><Send size={18}/></button></form>
          </>}
        </section>
      </div>

      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

      {incomingCall && <div className="fixed inset-0 z-[80] bg-primary/40 backdrop-blur-sm flex items-center justify-center p-4"><div className="w-full max-w-sm rounded-3xl bg-white p-7 shadow-2xl text-center animate-fade-in-up"><div className="mx-auto h-16 w-16 rounded-full bg-accent/10 flex items-center justify-center text-accent animate-pulse"><Phone size={28}/></div><p className="text-xs uppercase tracking-[0.16em] font-bold text-accent mt-4">Incoming voice call</p><h2 className="text-2xl font-bold text-primary mt-1">{incomingCaller?.caller_name || otherMember?.name || 'Someone is calling you'}</h2><p className="text-sm text-gray-500 mt-2">Answer to talk privately inside Campus Crib.</p><div className="grid grid-cols-2 gap-3 mt-6"><button onClick={declineIncoming} className="rounded-xl border border-gray-200 px-4 py-3 font-bold text-gray-700"><PhoneOff size={18} className="inline mr-2"/>Decline</button><button onClick={answerIncoming} className="rounded-xl bg-accent px-4 py-3 font-bold text-white"><PhoneCall size={18} className="inline mr-2"/>Answer</button></div></div></div>}

      {call && <div className="fixed bottom-5 right-5 z-[70] w-[min(390px,calc(100vw-2rem))] rounded-2xl bg-primary text-white p-4 shadow-2xl animate-fade-in-up"><div className="flex items-center gap-3"><div className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center"><Volume2 size={19}/></div><div className="flex-1 min-w-0"><p className="font-bold">Voice call</p><p className="text-xs text-white/70 truncate">{callContact?.name || otherMember?.name || 'Campus Crib Support'}</p></div><button onClick={() => endCall('ended')} className="h-10 w-10 rounded-full bg-red-500 flex items-center justify-center hover:bg-red-600"><PhoneOff size={18}/></button></div><div className="mt-3 flex items-center gap-2"><button onClick={toggleMute} className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/15">{isMuted ? <MicOff size={14}/> : <Mic size={14}/>} {isMuted ? 'Unmute' : 'Mute'}</button><span className="text-xs text-white/70">Private voice · your number is not shared</span></div>{callContact?.phone && <div className="mt-3 rounded-xl bg-white/10 p-3 text-xs"><p className="text-white/60">If the in-app call drops</p><div className="mt-1 flex items-center justify-between gap-3"><span className="font-semibold truncate">{callContact.phone}</span><button onClick={openFallbackPhone} className="rounded-lg bg-white text-primary px-3 py-1.5 font-bold">Call number</button></div></div>}</div>}
    </div>
  )
}
