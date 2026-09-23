import { Star } from 'lucide-react'

export default function RatingSummary({ average, count, size = 14 }) {
  if (!count) return null

  return (
    <span className="inline-flex items-center gap-1 text-sm text-gray-600">
      <Star size={size} className="fill-yellow-400 text-yellow-400" />
      {average.toFixed(1)} ({count})
    </span>
  )
}
