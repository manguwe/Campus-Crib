import { ChevronDown } from 'lucide-react'

/**
 * Thin wrapper around a native <select> that reskins the closed control
 * (rounded border, custom chevron, accent focus ring) instead of the
 * system default. The open options list is still the browser/OS native
 * one - that's standard behavior for styled selects on the web without
 * pulling in a full custom-listbox library, and keeps native keyboard/
 * screen-reader behavior for free.
 *
 * Usage is identical to a native select: value, onChange, children
 * (<option> elements), plus any extra props (id, required, etc).
 */
export default function Select({ className = '', children, ...props }) {
  return (
    <div className="relative">
      <select
        {...props}
        className={`w-full appearance-none rounded-lg border border-gray-300 bg-white px-3 py-2 pr-9 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent ${className}`}
      >
        {children}
      </select>
      <ChevronDown
        size={16}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
      />
    </div>
  )
}
