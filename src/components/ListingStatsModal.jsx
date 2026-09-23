import { X, Eye, Heart, Calendar } from 'lucide-react'

export default function ListingStatsModal({ property, stats, onClose }) {
  const hasViews = (stats?.total_views ?? 0) > 0

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <p className="font-medium text-gray-900 truncate pr-2">{property.title}</p>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors duration-150 shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-5">
          {!hasViews ? (
            <p className="text-sm text-gray-500 text-center py-4">No views yet — check back soon.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-xl p-3.5">
                <div className="flex items-center gap-1.5 text-gray-400 mb-1">
                  <Eye size={13} />
                  <span className="text-xs">Total views</span>
                </div>
                <p className="text-xl font-bold text-gray-900">{stats.total_views}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3.5">
                <div className="flex items-center gap-1.5 text-gray-400 mb-1">
                  <Calendar size={13} />
                  <span className="text-xs">Last 7 days</span>
                </div>
                <p className="text-xl font-bold text-gray-900">{stats.views_last_7_days}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3.5 col-span-2">
                <div className="flex items-center gap-1.5 text-gray-400 mb-1">
                  <Heart size={13} />
                  <span className="text-xs">Favourited by</span>
                </div>
                <p className="text-xl font-bold text-gray-900">
                  {stats.favourites_count} {stats.favourites_count === 1 ? 'student' : 'students'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
