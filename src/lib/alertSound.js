// Notification sounds and tab-title flashing for Campus Crib.
// Sounds are generated with the browser's Web Audio API, so no audio files are needed.
// Browsers only allow sound after the person has interacted with the page once (a click or key press);
// before that, alerts stay silent and only the visual notice appears.

const MUTE_KEY = 'cc_notif_sound_muted'

let audioContext = null
let ringTimer = null
let ringStopTimer = null
let flashTimer = null

export function isSoundMuted() {
  try {
    return localStorage.getItem(MUTE_KEY) === '1'
  } catch {
    return false
  }
}

export function setSoundMuted(muted) {
  try {
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0')
  } catch {
    // storage unavailable: the choice only lasts until the page reloads
  }
  if (muted) stopRing()
}

function getContext() {
  if (typeof window === 'undefined') return null
  const AudioCtx = window.AudioContext || window.webkitAudioContext
  if (!AudioCtx) return null
  if (!audioContext) audioContext = new AudioCtx()
  if (audioContext.state === 'suspended') audioContext.resume().catch(() => {})
  return audioContext
}

function tone(ctx, frequency, start, duration, volume) {
  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()
  oscillator.type = 'sine'
  oscillator.frequency.value = frequency
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  oscillator.connect(gain)
  gain.connect(ctx.destination)
  oscillator.start(start)
  oscillator.stop(start + duration + 0.05)
}

/** Short two-note chime for messages, announcements and other notifications. */
export function playChime() {
  if (isSoundMuted()) return
  const ctx = getContext()
  if (!ctx) return
  const now = ctx.currentTime
  tone(ctx, 880, now, 0.18, 0.25)
  tone(ctx, 1320, now + 0.16, 0.28, 0.25)
}

// One "brrring" burst: two tones (440 and 480 Hz, like a classic phone) switched on and off 10 times a second.
function ringBurst(ctx, start, duration) {
  const low = ctx.createOscillator()
  const high = ctx.createOscillator()
  const gain = ctx.createGain()
  low.frequency.value = 440
  high.frequency.value = 480
  low.connect(gain)
  high.connect(gain)
  gain.connect(ctx.destination)
  gain.gain.setValueAtTime(0, start)
  const step = 0.05
  let on = true
  for (let t = 0; t < duration; t += step) {
    gain.gain.setValueAtTime(on ? 0.4 : 0, start + t)
    on = !on
  }
  gain.gain.setValueAtTime(0, start + duration)
  low.start(start)
  high.start(start)
  low.stop(start + duration + 0.05)
  high.stop(start + duration + 0.05)
}

function ringOnce() {
  const ctx = getContext()
  if (!ctx) return
  const now = ctx.currentTime
  ringBurst(ctx, now, 0.5)
  ringBurst(ctx, now + 0.7, 0.5)
  try {
    if (navigator.vibrate) navigator.vibrate([400, 200, 400])
  } catch {
    // vibration not allowed here
  }
}

/** Repeating ring for an incoming call. Stops by itself after maxSeconds. */
export function startRing(maxSeconds = 40) {
  if (isSoundMuted() || ringTimer) return
  ringOnce()
  ringTimer = window.setInterval(ringOnce, 2800)
  ringStopTimer = window.setTimeout(stopRing, maxSeconds * 1000)
}

export function stopRing() {
  if (ringTimer) {
    window.clearInterval(ringTimer)
    ringTimer = null
  }
  if (ringStopTimer) {
    window.clearTimeout(ringStopTimer)
    ringStopTimer = null
  }
}

/** While the tab is in the background, alternates the tab title with `text` until the person comes back. */
export function flashTitle(text) {
  if (typeof document === 'undefined' || !document.hidden || flashTimer) return
  const originalTitle = document.title
  let showAlert = true
  flashTimer = window.setInterval(() => {
    document.title = showAlert ? text : originalTitle
    showAlert = !showAlert
  }, 1000)

  const stop = () => {
    if (document.hidden) return
    window.clearInterval(flashTimer)
    flashTimer = null
    document.title = originalTitle
    document.removeEventListener('visibilitychange', stop)
  }
  document.addEventListener('visibilitychange', stop)
}

/** Call once at startup so the first click or key press unlocks sound for the rest of the session. */
export function unlockAudioOnFirstInteraction() {
  if (typeof window === 'undefined') return
  const unlock = () => {
    getContext()
    window.removeEventListener('pointerdown', unlock)
    window.removeEventListener('keydown', unlock)
  }
  window.addEventListener('pointerdown', unlock, { once: true })
  window.addEventListener('keydown', unlock, { once: true })
}
