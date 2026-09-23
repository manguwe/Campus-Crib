import { AVAILABILITY_STATUS_OPTIONS, AVAILABILITY_STATUS_DOT_COLORS } from '../lib/constants'

/** Segmented button group for picking a listing's availability status.
 * Used both as a full-size control in PropertyEditor and, with
 * `compact`, as a quick-edit pill group inline in a LandlordDashboard
 * listing row. */
export default function AvailabilityStatusControl({ value, onChange, disabled = false, compact = false }) {
  return (
    <div
      role="radiogroup"
      className={`inline-flex flex-wrap items-center gap-1 rounded-full border border-gray-200 bg-gray-50 ${
        compact ? 'p-0.5' : 'p-1'
      }`}
    >
      {AVAILABILITY_STATUS_OPTIONS.map((opt) => {
        const active = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => !active && onChange(opt.value)}
            className={`inline-flex items-center gap-1.5 rounded-full font-medium transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${
              compact ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-sm'
            } ${
              active
                ? 'bg-white shadow-sm text-gray-900 border border-gray-200'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span
              className={`inline-block rounded-full shrink-0 ${compact ? 'w-1.5 h-1.5' : 'w-2 h-2'} ${
                AVAILABILITY_STATUS_DOT_COLORS[opt.value]
              }`}
            />
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
