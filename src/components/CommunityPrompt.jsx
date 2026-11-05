import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { X, MessageCircle, Facebook, Instagram, Music2, MapPin, UserPlus } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useSitePromotions } from '../hooks/useSitePromotions'
import { OPEN_COMMUNITY_EVENT, safeLink } from '../lib/promotions'
import { logActivity } from '../lib/activityLog'

const STORAGE_KEY = 'cc_community_prompt'
const SESSION_KEY = 'cc_community_prompt_session'

function readState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
  } catch {
    return {}
  }
}
function writeState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // storage unavailable: the popup may appear again next time
  }
}

// Only public browsing pages show the popup, never dashboards, chat, admin or sign-in screens.
function isPublicPage(pathname) {
  if (pathname === '/' || pathname === '/browse') return true
  return pathname.startsWith('/properties/') && !pathname.endsWith('/access')
}

/** A friendly popup inviting visitors to the community and to the partner site where students can list rooms. */
export default function CommunityPrompt() {
  const promotions = useSitePromotions()
  const { role } = useAuth()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const openedAt = useRef(Date.now())

  const links = {
    whatsapp: safeLink(promotions?.whatsapp_url),
    tiktok: safeLink(promotions?.tiktok_url),
    facebook: safeLink(promotions?.facebook_url),
    instagram: safeLink(promotions?.instagram_url),
  }
  const partner = safeLink(promotions?.partner_url).replace(/\/$/, '')
  const hasContent = Boolean(partner) || Object.values(links).some(Boolean)
  const eligible = Boolean(promotions?.enabled) && hasContent && role !== 'admin' && isPublicPage(pathname)

  const show = useCallback(
    (trigger, { force = false } = {}) => {
      if (!eligible && !force) return
      if (document.visibilityState !== 'visible') return
      if (!force) {
        const state = readState()
        if (state.dismissedForever) return
        const repeatMs = Number(promotions?.repeat_days ?? 3) * 86400000
        if (state.shownAt && Date.now() - state.shownAt < repeatMs) return
        try {
          if (sessionStorage.getItem(SESSION_KEY)) return
        } catch {
          // ignore
        }
      }
      setOpen((already) => {
        if (already) return already
        logActivity('community_prompt_shown', { details: { trigger } })
        return true
      })
      if (!force) {
        writeState({ ...readState(), shownAt: Date.now() })
        try {
          sessionStorage.setItem(SESSION_KEY, '1')
        } catch {
          // ignore
        }
      }
    },
    [eligible, promotions?.repeat_days],
  )

  // Timer: appears after the visitor has been on a public page for a little while
  useEffect(() => {
    if (!eligible) return undefined
    const delay = Math.max(5, Number(promotions?.delay_seconds ?? 25)) * 1000
    const timer = window.setTimeout(() => show('timer'), delay)
    return () => window.clearTimeout(timer)
  }, [eligible, promotions?.delay_seconds, show])

  // Exit intent (computers): the mouse leaves through the top of the window, e.g. towards the tab bar
  useEffect(() => {
    if (!eligible) return undefined
    const onMouseOut = (e) => {
      if (e.clientY > 0 || e.relatedTarget) return
      if (Date.now() - openedAt.current < 8000) return
      show('exit')
    }
    document.addEventListener('mouseout', onMouseOut)
    return () => document.removeEventListener('mouseout', onMouseOut)
  }, [eligible, show])

  // Opened on request (the footer link or the admin preview button)
  useEffect(() => {
    const onRequest = () => show('manual', { force: true })
    window.addEventListener(OPEN_COMMUNITY_EVENT, onRequest)
    return () => window.removeEventListener(OPEN_COMMUNITY_EVENT, onRequest)
  }, [show])

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!open || !promotions) return null

  const track = (target) => logActivity('community_click', { details: { target } })
  const dontShowAgain = () => {
    writeState({ ...readState(), dismissedForever: true })
    setOpen(false)
  }

  const socialButtons = [
    { key: 'whatsapp', label: 'Join our WhatsApp group', url: links.whatsapp, Icon: MessageCircle, color: 'bg-green-600 hover:bg-green-700' },
    { key: 'tiktok', label: 'Follow us on TikTok', url: links.tiktok, Icon: Music2, color: 'bg-black hover:bg-gray-800' },
    { key: 'facebook', label: 'Follow us on Facebook', url: links.facebook, Icon: Facebook, color: 'bg-blue-600 hover:bg-blue-700' },
    { key: 'instagram', label: 'Follow us on Instagram', url: links.instagram, Icon: Instagram, color: 'bg-pink-600 hover:bg-pink-700' },
  ].filter((b) => b.url)

  return (
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-3 sm:p-6" role="dialog" aria-modal="true" aria-label="Join the Campus Crib community">
      <button className="absolute inset-0 bg-black/50" aria-label="Close" onClick={() => setOpen(false)} />
      <div className="relative w-full max-w-md max-h-[92vh] overflow-y-auto rounded-2xl bg-white shadow-2xl p-5 sm:p-6">
        <button onClick={() => setOpen(false)} aria-label="Close" className="absolute right-3 top-3 rounded-full p-1.5 text-gray-500 hover:bg-gray-100">
          <X size={18} />
        </button>

        {socialButtons.length > 0 && (
          <div>
            <h2 className="text-lg font-bold text-primary pr-8">Join the Campus Crib community</h2>
            <p className="mt-1 text-sm text-gray-600">Get new rooms, tips and updates, and watch our videos.</p>
            <div className="mt-4 space-y-2">
              {socialButtons.map(({ key, label, url, Icon, color }) => (
                <a
                  key={key}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => track(key)}
                  className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white ${color}`}
                >
                  <Icon size={17} /> {label}
                </a>
              ))}
            </div>
          </div>
        )}

        {partner && (
          <div className={socialButtons.length > 0 ? 'mt-5 border-t border-gray-100 pt-5' : ''}>
            <h3 className="text-base font-bold text-primary pr-8">Know a room? Share it.</h3>
            <p className="mt-1 text-sm text-gray-600">{promotions.partner_headline}</p>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <a
                href={`${partner}/list`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => track('partner_list')}
                className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark"
              >
                <MapPin size={16} /> List a room
              </a>
              <a
                href={`${partner}/register`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => track('partner_register')}
                className="flex items-center justify-center gap-2 rounded-xl border border-primary px-4 py-2.5 text-sm font-semibold text-primary hover:bg-primary/5"
              >
                <UserPlus size={16} /> Become an agent
              </a>
            </div>
          </div>
        )}

        <div className="mt-5 flex items-center justify-between text-xs text-gray-500">
          <button onClick={() => setOpen(false)} className="underline hover:text-gray-700">Not now</button>
          <button onClick={dontShowAgain} className="underline hover:text-gray-700">Don't show this again</button>
        </div>
      </div>
    </div>
  )
}
