import { supabase } from './supabaseClient'

export async function startListingChat(propertyId) {
  const { data, error } = await supabase.rpc('start_listing_conversation', { p_property_id: propertyId })
  if (error) throw error
  return data
}

export async function startSupportChat() {
  const { data, error } = await supabase.rpc('start_support_conversation')
  if (error) throw error
  return data
}

export async function loadConversations(userId) {
  const { data, error } = await supabase
    .from('conversation_members')
    .select('conversation_id, conversations(id, property_id, kind, updated_at, created_at)')
    .eq('user_id', userId)
    .order('joined_at', { ascending: false })
  if (error) throw error

  const ids = (data || []).map((row) => row.conversation_id)
  if (!ids.length) return []

  const { data: members, error: memberError } = await supabase
    .from('conversation_members')
    .select('conversation_id, user_id, profiles(id, name, role)')
    .in('conversation_id', ids)
  if (memberError) throw memberError

  return (data || []).map((row) => ({
    ...row.conversations,
    members: (members || []).filter((m) => m.conversation_id === row.conversation_id),
  }))
}

export async function loadMessages(conversationId) {
  const { data, error } = await supabase
    .from('messages')
    .select('id, conversation_id, sender_id, body, created_at, profiles(name, role)')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(300)
  if (error) throw error
  return data || []
}

export async function sendMessage(conversationId, senderId, body) {
  const text = body.trim()
  if (!text) return null
  const { data, error } = await supabase
    .from('messages')
    .insert({ conversation_id: conversationId, sender_id: senderId, body: text })
    .select('id, conversation_id, sender_id, body, created_at, profiles(name, role)')
    .single()
  if (error) throw error
  return data
}

export async function startVoiceCall(conversationId, callerId, calleeId) {
  const { data, error } = await supabase
    .from('voice_calls')
    .insert({ conversation_id: conversationId, caller_id: callerId, callee_id: calleeId, status: 'ringing' })
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function sendCallSignal(callId, senderId, signalType, payload = null) {
  const { error } = await supabase.from('voice_call_signals').insert({
    call_id: callId,
    sender_id: senderId,
    signal_type: signalType,
    payload,
  })
  if (error) throw error
}

export async function updateCall(callId, status) {
  const values = { status }
  if (status === 'active') values.started_at = new Date().toISOString()
  if (['ended', 'declined', 'missed'].includes(status)) values.ended_at = new Date().toISOString()
  const { error } = await supabase.from('voice_calls').update(values).eq('id', callId)
  if (error) throw error
}
