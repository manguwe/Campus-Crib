import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { formatSupabaseError } from '../../lib/errorMessages'
import { fetchSitePromotions, saveSitePromotions, OPEN_COMMUNITY_EVENT } from '../../lib/promotions'

const input = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent'

/** Admin: switch the community popup on or off and edit its links and wording. Starts OFF. */
export default function AdminPromotions() {
  const [form, setForm] = useState({
    enabled: false,
    partnerUrl: 'https://campus-crib-agent.vercel.app',
    partnerHeadline: '',
    whatsappUrl: '',
    tiktokUrl: '',
    facebookUrl: '',
    instagramUrl: '',
    delaySeconds: '25',
    repeatDays: '3',
  })
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    ;(async () => {
      const s = await fetchSitePromotions({ force: true })
      if (s) {
        setForm({
          enabled: Boolean(s.enabled),
          partnerUrl: s.partner_url || '',
          partnerHeadline: s.partner_headline || '',
          whatsappUrl: s.whatsapp_url || '',
          tiktokUrl: s.tiktok_url || '',
          facebookUrl: s.facebook_url || '',
          instagramUrl: s.instagram_url || '',
          delaySeconds: String(s.delay_seconds ?? 25),
          repeatDays: String(s.repeat_days ?? 3),
        })
      }
      setLoaded(true)
    })()
  }, [])

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setMessage('')
  }

  async function handleSave(e) {
    e.preventDefault()
    setError('')
    setMessage('')
    setSaving(true)
    try {
      await saveSitePromotions(form)
      setMessage(form.enabled ? 'Saved. The popup is ON for visitors.' : 'Saved. The popup is OFF.')
    } catch (err) {
      setError(formatSupabaseError(err, 'Could not save the promotion settings.'))
    }
    setSaving(false)
  }

  const field = (label, key, placeholder, help) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type="url"
        value={form[key]}
        onChange={(e) => update(key, e.target.value)}
        placeholder={placeholder}
        className={input}
        disabled={!loaded}
      />
      {help && <p className="text-xs text-gray-500 mt-1">{help}</p>}
    </div>
  )

  return (
    <form onSubmit={handleSave} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-5 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold text-primary">Community and partner-site popup</h2>
        <p className="text-sm text-gray-500 mt-1">
          A friendly popup on the public pages (home, browse, listings). It invites visitors to join your social media and WhatsApp group, and sends
          people who know a room to your agent site. On computers it also appears when the mouse leaves the window; on phones it appears after a short time.
        </p>
      </div>

      <label className="flex items-center gap-2 text-sm font-medium text-gray-800">
        <input
          type="checkbox"
          checked={form.enabled}
          onChange={(e) => update('enabled', e.target.checked)}
          className="rounded border-gray-300 text-accent focus:ring-accent"
          disabled={!loaded}
        />
        Show the popup to visitors
      </label>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-800">Your communities (leave a link empty to hide that button)</h3>
        {field('WhatsApp group link', 'whatsappUrl', 'https://chat.whatsapp.com/...', 'Use the invite link from WhatsApp: group info, then Invite via link.')}
        {field('TikTok page', 'tiktokUrl', 'https://www.tiktok.com/@yourname')}
        {field('Facebook page', 'facebookUrl', 'https://www.facebook.com/yourpage')}
        {field('Instagram page (optional)', 'instagramUrl', 'https://www.instagram.com/yourname')}
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-800">Partner site (where students list rooms)</h3>
        {field('Partner site address', 'partnerUrl', 'https://campus-crib-agent.vercel.app', 'The popup adds /list and /register to this address.')}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Headline</label>
          <input
            type="text"
            maxLength={160}
            value={form.partnerHeadline}
            onChange={(e) => update('partnerHeadline', e.target.value)}
            placeholder="Know a boarding-house room near campus? Earn K20 for every approved room."
            className={input}
            disabled={!loaded}
          />
          <p className="text-xs text-gray-500 mt-1">Leave empty to use the default wording. If the reward changes, update it here.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Appears after (seconds)</label>
          <input type="number" min="5" max="300" value={form.delaySeconds} onChange={(e) => update('delaySeconds', e.target.value)} className={input} disabled={!loaded} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Show again after (days)</label>
          <input type="number" min="0" max="60" value={form.repeatDays} onChange={(e) => update('repeatDays', e.target.value)} className={input} disabled={!loaded} />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={saving || !loaded}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
        >
          {saving && <Loader2 size={15} className="animate-spin" />}
          Save
        </button>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event(OPEN_COMMUNITY_EVENT))}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          Preview popup (after saving)
        </button>
        {message && <span className="text-sm text-gray-600">{message}</span>}
      </div>
    </form>
  )
}
