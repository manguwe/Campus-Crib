import { AlertCircle } from 'lucide-react'

/** Consistent error display. Pass either a raw string (already formatted
 * by formatSupabaseError) or nothing to render null. */
export default function ErrorBanner({ message, className = '' }) {
  if (!message) return null
  return (
    <div
      role="alert"
      className={`flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 ${className}`}
    >
      <AlertCircle size={16} className="shrink-0 mt-0.5" />
      <span>{message}</span>
    </div>
  )
}
