import { Loader2 } from 'lucide-react'

/** Small inline spinner. Use `label` for a visible caption, or `srLabel`
 * for a screen-reader-only one when the spinner sits next to text that
 * already explains what's loading. */
export default function Spinner({ label, srLabel = 'Loading', size = 16, className = '' }) {
  return (
    <div className={`flex items-center gap-2 text-gray-400 ${className}`} role="status">
      <Loader2 size={size} className="animate-spin" />
      {label ? <span className="text-sm">{label}</span> : <span className="sr-only">{srLabel}</span>}
    </div>
  )
}
