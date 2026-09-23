import { Link } from 'react-router-dom'
import { Inbox } from 'lucide-react'

/** Centered "nothing here" block. `action` (optional) is either
 * { label, to } for a Link, or { label, onClick } for a button. */
export default function EmptyState({ icon: Icon = Inbox, title, description, action, className = '' }) {
  return (
    <div className={`flex flex-col items-center text-center py-12 px-4 ${className}`}>
      <div className="bg-gray-100 rounded-full p-3 mb-3">
        <Icon size={22} className="text-gray-400" />
      </div>
      <p className="font-medium text-gray-900">{title}</p>
      {description && <p className="text-sm text-gray-500 mt-1 max-w-sm">{description}</p>}
      {action && action.to && (
        <Link
          to={action.to}
          className="mt-4 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark transition-all duration-150 hover:scale-[1.02] active:scale-[0.98]"
        >
          {action.label}
        </Link>
      )}
      {action && action.onClick && (
        <button
          onClick={action.onClick}
          className="mt-4 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark transition-all duration-150 hover:scale-[1.02] active:scale-[0.98]"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
