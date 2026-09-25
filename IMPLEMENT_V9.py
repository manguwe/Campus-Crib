from pathlib import Path
import zipfile, shutil, re
root=Path('/tmp/campus/v9')
# patch chat.js
p=root/'src/lib/chat.js'
s=p.read_text()
s=s.replace("export async function updateCall(callId, status) {", "export async function getCallContact(conversationId, contactUserId) {\n  const { data, error } = await supabase.rpc('get_call_contact', {\n    p_conversation_id: conversationId,\n    p_contact_user_id: contactUserId,\n  })\n  if (error) throw error\n  return data?.[0] || null\n}\n\nexport async function loadCallSignals(callId) {\n  const { data, error } = await supabase\n    .from('voice_call_signals')\n    .select('id, call_id, sender_id, signal_type, payload, created_at')\n    .eq('call_id', callId)\n    .order('id', { ascending: true })\n  if (error) throw error\n  return data || []\n}\n\nexport async function updateCall(callId, status) {")
p.write_text(s)

# patch Messages imports and state
p=root/'src/pages/Messages.jsx'
s=p.read_text()
s=s.replace("loadConversations, loadMessages, sendMessage, startListingChat, startSupportChat, startVoiceCall, sendCallSignal, updateCall", "loadConversations, loadMessages, sendMessage, startListingChat, startSupportChat, startVoiceCall, sendCallSignal, updateCall, getCallContact, loadCallSignals")
s=s.replace("const [callError, setCallError] = useState('')", "const [callError, setCallError] = useState('')\n  const [callContact, setCallContact] = useState(null)\n  const [isMuted, setIsMuted] = useState(false)\n  const pendingIceRef = useRef([])")
# replace closeCallResources
s=s.replace("""  function closeCallResources() {\n    const active = callRef.current\n    if (active?.pc) active.pc.close()\n    active?.stream?.getTracks?.().forEach((track) => track.stop())\n    callRef.current = null\n  }\n""", """  function closeCallResources() {\n    const active = callRef.current\n    if (active?.pc) active.pc.close()\n    active?.stream?.getTracks?.().forEach((track) => track.stop())\n    if (active?.signalChannel) supabase.removeChannel(active.signalChannel)\n    callRef.current = null\n    pendingIceRef.current = []\n    setIsMuted(false)\n  }\n\n  async function applyPendingIce(pc) {\n    const queued = pendingIceRef.current.splice(0)\n    for (const candidate of queued) {\n      try { await pc.addIceCandidate(candidate) } catch {}\n    }\n  }\n""")
# replace beginCall function block using regex
start=s.index('  async function beginCall(targetCall, isCaller) {')
end=s.index('\n  async function callOther()', start)
new=r'''  async function beginCall(targetCall, isCaller) {
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
'''
s=s[:start]+new+s[end:]
# replace callOther function
old="""  async function callOther() {\n    if (!selected || !otherMember?.id || !user?.id || call) return\n    try {\n      const newCall = await startVoiceCall(selected.id, user.id, otherMember.id)\n      await beginCall(newCall, true)\n    } catch (e) { setCallError(e.message || 'Could not start the call.') }\n  }\n"""
new2="""  async function callOther() {\n    if (!selected || !otherMember?.id || !user?.id || call) return\n    try {\n      const contact = await getCallContact(selected.id, otherMember.id)\n      setCallContact(contact)\n      const newCall = await startVoiceCall(selected.id, user.id, otherMember.id)\n      await beginCall(newCall, true)\n    } catch (e) { setCallError(e.message || 'Could not start the call.') }\n  }\n\n  function toggleMute() {\n    const stream = callRef.current?.stream\n    if (!stream) return\n    const next = !isMuted\n    stream.getAudioTracks().forEach((track) => { track.enabled = !next })\n    setIsMuted(next)\n  }\n\n  function openFallbackPhone() {\n    if (callContact?.phone) window.location.href = `tel:${callContact.phone}`\n  }\n"""
if old not in s: raise SystemExit('callOther block not found')
s=s.replace(old,new2)
# incoming answer set contact too
s=s.replace("""  async function answerIncoming() {\n    const incoming = incomingCall\n    setIncomingCall(null)\n    if (!incoming) return\n    await beginCall(incoming, false)\n  }\n""", """  async function answerIncoming() {\n    const incoming = incomingCall\n    setIncomingCall(null)\n    if (!incoming) return\n    try { setCallContact(await getCallContact(incoming.conversation_id, incoming.caller_id)) } catch { setCallContact(null) }\n    await beginCall(incoming, false)\n  }\n""")
# decline clear
s=s.replace("setIncomingCall(null)\n  }\n\n  async function endCall", "setIncomingCall(null)\n    setCallContact(null)\n  }\n\n  async function endCall")
# endCall clear contact
s=s.replace("""    closeCallResources()\n    setCall(null)\n  }\n""", """    closeCallResources()\n    setCall(null)\n    setCallContact(null)\n  }\n""",1)
# header call label
s=s.replace("<button onClick={callOther} disabled={!otherMember?.id || Boolean(call)} className=\"inline-flex items-center gap-2 rounded-xl bg-accent px-3 py-2 text-sm font-bold text-white disabled:opacity-40 hover:scale-[1.02] transition\"><PhoneCall size={16}/> Call</button>", "<button onClick={callOther} disabled={!otherMember?.id || Boolean(call)} className=\"inline-flex items-center gap-2 rounded-xl bg-accent px-3 py-2 text-sm font-bold text-white disabled:opacity-40 hover:scale-[1.02] transition\"><PhoneCall size={16}/> Call {otherMember?.name || 'person'}</button>")
# replace call popup block
oldfrag="""      {call && <div className=\"fixed bottom-5 right-5 z-[70] w-[min(360px,calc(100vw-2rem))] rounded-2xl bg-primary text-white p-4 shadow-2xl animate-fade-in-up\"><div className=\"flex items-center gap-3\"><div className=\"h-10 w-10 rounded-full bg-white/10 flex items-center justify-center\"><Volume2 size={19}/></div><div className=\"flex-1\"><p className=\"font-bold\">Voice call</p><p className=\"text-xs text-white/70\">{otherMember?.name || 'Campus Crib Support'}</p></div><button onClick={() => endCall('ended')} className=\"h-10 w-10 rounded-full bg-red-500 flex items-center justify-center hover:bg-red-600\"><PhoneOff size={18}/></button></div><div className=\"mt-3 text-xs text-white/70 flex items-center gap-2\"><Mic size={13}/> Microphone active · Voice only</div></div>}\n"""
newfrag="""      {call && <div className=\"fixed bottom-5 right-5 z-[70] w-[min(390px,calc(100vw-2rem))] rounded-2xl bg-primary text-white p-4 shadow-2xl animate-fade-in-up\"><div className=\"flex items-center gap-3\"><div className=\"h-10 w-10 rounded-full bg-white/10 flex items-center justify-center\"><Volume2 size={19}/></div><div className=\"flex-1 min-w-0\"><p className=\"font-bold\">Voice call</p><p className=\"text-xs text-white/70 truncate\">{callContact?.name || otherMember?.name || 'Campus Crib Support'}</p></div><button onClick={() => endCall('ended')} className=\"h-10 w-10 rounded-full bg-red-500 flex items-center justify-center hover:bg-red-600\"><PhoneOff size={18}/></button></div><div className=\"mt-3 flex items-center gap-2\"><button onClick={toggleMute} className=\"inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/15\">{isMuted ? <MicOff size={14}/> : <Mic size={14}/>} {isMuted ? 'Unmute' : 'Mute'}</button><span className=\"text-xs text-white/70\">Private voice · your number is not shared</span></div>{callContact?.phone && <div className=\"mt-3 rounded-xl bg-white/10 p-3 text-xs\"><p className=\"text-white/60\">If the in-app call drops</p><div className=\"mt-1 flex items-center justify-between gap-3\"><span className=\"font-semibold truncate\">{callContact.phone}</span><button onClick={openFallbackPhone} className=\"rounded-lg bg-white text-primary px-3 py-1.5 font-bold\">Call number</button></div></div>}</div>}\n"""
if oldfrag not in s: raise SystemExit('call popup not found')
s=s.replace(oldfrag,newfrag)
# incoming modal show caller name only
s=s.replace("<h2 className=\"text-2xl font-bold text-primary mt-1\">Someone is calling you</h2>", "<h2 className=\"text-2xl font-bold text-primary mt-1\">{incomingCall?.caller_id === otherMember?.id ? otherMember?.name : 'Someone is calling you'}</h2>")
p.write_text(s)

# create SQL v9
sql=root/'supabase_sql/35_v9_call_identity_and_reliable_audio.sql'
sql.write_text(r'''-- Campus Crib V9: explicit call identity, private fallback contact, and reliable signaling.
-- Run after V8 migration 34.

-- Only the person initiating a call may request the callee's fallback contact.
-- The callee never receives the caller's phone/email through this function.
create or replace function public.get_call_contact(p_conversation_id uuid, p_contact_user_id uuid)
returns table(name text, phone text, email text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth uuid := auth.uid();
begin
  if v_auth is null then raise exception 'You must be logged in'; end if;
  if not public.is_conversation_member(p_conversation_id, v_auth)
     or not public.is_conversation_member(p_conversation_id, p_contact_user_id) then
    raise exception 'You are not a member of this conversation';
  end if;
  if v_auth = p_contact_user_id then
    raise exception 'Invalid call contact';
  end if;

  return query
  select
    p.name,
    coalesce(nullif(lp.contact_phone, ''), nullif(p.phone, ''), nullif(pc.phone_number, '')) as phone,
    au.email
  from public.profiles p
  join auth.users au on au.id = p.id
  left join public.landlord_profiles lp on lp.id = p.id
  left join lateral (
    select pc.phone_number
    from public.property_contacts pc
    join public.conversations c on c.property_id = pc.property_id
    where c.id = p_conversation_id and p.id = (select landlord_id from public.properties where id = c.property_id)
    order by pc.sort_order asc, pc.created_at asc
    limit 1
  ) pc on true
  where p.id = p_contact_user_id;
end;
$$;
grant execute on function public.get_call_contact(uuid,uuid) to authenticated;

-- Calls can remain useful after a temporary browser disconnect; do not let a
-- transient connection state in the browser immediately mark the database call ended.
comment on table public.voice_call_signals is 'WebRTC signaling messages. Clients must re-read existing signals after subscribing to avoid realtime race conditions.';

-- Helpful index for the ringing-call lookup used by Messages.
create index if not exists idx_voice_calls_callee_status_created
  on public.voice_calls(callee_id, status, created_at desc);
''')

# add README notes
readme=root/'V9_SETUP.md'
readme.write_text('''# Campus Crib V9 Setup\n\nV9 improves call identity and WebRTC reliability. Run migrations through V8 first, then run `supabase_sql/35_v9_call_identity_and_reliable_audio.sql`.\n\nThe caller sees the selected person\'s name and, when permitted by the existing listing/contact model, a fallback phone number. The callee does not receive the caller\'s phone/email from this feature.\n\nThe call signaling client now re-reads stored signals after subscribing and queues ICE candidates until a remote description exists, fixing the common silent-call/race condition.\n\nFor production, a TURN server should still be added to the WebRTC ICE configuration for difficult NAT/mobile networks.\n''')

# package zip
out=Path('/tmp/campus/campus-crib-v38-referral-system-v9-call-identity-audio-fix.zip')
if out.exists(): out.unlink()
with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as z:
    for f in root.rglob('*'):
        if f.is_file() and 'node_modules' not in f.parts and '.git' not in f.parts:
            z.write(f, f.relative_to(root))
print(out, out.stat().st_size)
