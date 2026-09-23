import { AVAILABILITY_STATUS_BADGE_STYLES, AVAILABILITY_STATUS_LABELS } from '../lib/constants'

/** Small colour-coded pill showing a listing's availability status.
 * Renders nothing if `status` is missing so older cached rows without
 * the column selected yet just quietly show no badge. */
export default function AvailabilityStatusBadge({ status, className = '' }) {
  if (!status || !AVAILABILITY_STATUS_LABELS[status]) return null

  return (
    <span
      className={`text-xs font-medium rounded-full px-2.5 py-1 ${AVAILABILITY_STATUS_BADGE_STYLES[status]} ${className}`}
    >
      {AVAILABILITY_STATUS_LABELS[status]}
    </span>
  )
}
