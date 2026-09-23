import { useEffect, useState } from 'react'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { usePlatformMode } from '../../context/PlatformModeContext'

const MODES = [
  { value: 'pre_launch', label: 'Pre-Launch', description: 'Show the research/interest experience and keep the marketplace hidden.' },
  { value: 'public_launch', label: 'Public Launch', description: 'Show the full marketplace while keeping referrals and feedback active.' },
  { value: 'maintenance', label: 'Maintenance', description: 'Temporarily block public access while administrators remain able to work.' },
]

export default function AdminPlatformMode() {
  const { mode, refresh } = usePlatformMode()
  const [selected, setSelected] = useState(mode)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => setSelected(mode), [mode])

  async function save() {
    setSaving(true)
    setMessage('')
    const { error } = await supabase.rpc('set_platform_mode', { p_mode: selected })
    if (error) setMessage(error.message || 'Could not update platform mode.')
    else {
      await refresh()
      setMessage('Platform mode updated.')
    }
    setSaving(false)
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 max-w-3xl">
      <h2 className="text-lg font-semibold text-primary">Platform mode</h2>
      <p className="text-sm text-gray-500 mt-1">Control whether Campus Crib is in research preparation, public launch, or maintenance.</p>

      <div className="grid gap-3 mt-5">
        {MODES.map((item) => (
          <button key={item.value} type="button" onClick={() => setSelected(item.value)} className={`text-left rounded-xl border p-4 ${selected === item.value ? 'border-accent bg-accent/5' : 'border-gray-200 hover:bg-gray-50'}`}>
            <div className="flex items-start gap-3">
              <span className={`mt-0.5 w-4 h-4 rounded-full border ${selected === item.value ? 'border-accent bg-accent ring-2 ring-accent/20' : 'border-gray-300'}`} />
              <div><p className="font-semibold text-gray-900">{item.label}</p><p className="text-sm text-gray-500 mt-1">{item.description}</p></div>
            </div>
          </button>
        ))}
      </div>

      <button onClick={save} disabled={saving || selected === mode} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-primary text-white px-4 py-2 text-sm font-semibold disabled:opacity-50">
        {saving && <Loader2 size={15} className="animate-spin" />}
        Save mode
      </button>
      {message && <p className="mt-3 text-sm text-gray-600 inline-flex items-center gap-1.5"><CheckCircle2 size={15} className="text-accent" />{message}</p>}
    </div>
  )
}
