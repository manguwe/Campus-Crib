import { useEffect, useState } from 'react'
import { Star, Loader2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { formatSupabaseError } from '../lib/errorMessages'
import { logActivity } from '../lib/activityLog'
import ErrorBanner from './ui/ErrorBanner'

export default function ReviewsSection({ propertyId, onSummaryChange }) {
  const { user, role } = useAuth()
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)

  async function loadReviews() {
    setLoading(true)
    // Deliberately not joining profiles for a reviewer name - profiles
    // are only readable by authenticated users (02_policies.sql), so an
    // anonymous visitor on this same public page would just see blanks.
    // Showing reviews anonymously keeps it consistent for every visitor.
    const { data, error } = await supabase
      .from('reviews')
      .select('id, student_id, rating, comment, created_at')
      .eq('property_id', propertyId)
      .order('created_at', { ascending: false })

    if (error) setError(formatSupabaseError(error, 'Could not load reviews.'))
    else setReviews(data)
    setLoading(false)

    if (!error) {
      onSummaryChange?.(
        data.length > 0
          ? { average: data.reduce((sum, r) => sum + r.rating, 0) / data.length, count: data.length }
          : null
      )
    }
  }

  useEffect(() => {
    loadReviews()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId])

  const myReview = user ? reviews.find((r) => r.student_id === user.id) : null

  function startEditing() {
    setRating(myReview?.rating ?? 5)
    setComment(myReview?.comment ?? '')
    setEditing(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (comment.trim().length > 1000) {
      setError('Comments must be under 1000 characters.')
      return
    }

    setSaving(true)

    const payload = { property_id: propertyId, student_id: user.id, rating, comment: comment.trim() || null }

    const { error: saveError } = myReview
      ? await supabase.from('reviews').update({ rating, comment: payload.comment }).eq('id', myReview.id)
      : await supabase.from('reviews').insert(payload)

    setSaving(false)

    if (saveError) {
      setError(formatSupabaseError(saveError, 'Could not save your review.'))
      return
    }

    if (!myReview) {
      logActivity('review_submitted', { details: { property_id: propertyId, rating } })
    }

    setEditing(false)
    await loadReviews()
  }

  const average =
    reviews.length > 0 ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1) : null

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-primary">Reviews</h2>
        {average && (
          <span className="flex items-center gap-1 text-sm text-gray-600">
            <Star size={14} className="fill-yellow-400 text-yellow-400" />
            {average} ({reviews.length})
          </span>
        )}
      </div>

      {loading && <p className="text-sm text-gray-400">Loading reviews…</p>}

      {!loading && reviews.length === 0 && (
        <p className="text-sm text-gray-400 mb-4">No reviews yet.</p>
      )}

      <ul className="space-y-3 mb-5">
        {reviews.map((r) => (
          <li key={r.id} className="border-b border-gray-100 pb-3 last:border-0">
            <div className="flex items-center gap-1 text-sm">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  size={14}
                  className={i < r.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'}
                />
              ))}
              {user && r.student_id === user.id && (
                <span className="text-xs text-gray-400 ml-2">(your review)</span>
              )}
            </div>
            {r.comment && <p className="text-sm text-gray-700 mt-1">{r.comment}</p>}
          </li>
        ))}
      </ul>

      {!user && <p className="text-sm text-gray-400">Log in as a student to leave a review.</p>}

      {user && role === 'student' && !editing && (
        <button onClick={startEditing} className="text-sm font-medium text-accent underline">
          {myReview ? 'Edit your review' : 'Write a review'}
        </button>
      )}

      {user && role === 'student' && editing && (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rating</label>
            <div className="flex gap-1">
              {Array.from({ length: 5 }).map((_, i) => {
                const value = i + 1
                return (
                  <button
                    type="button"
                    key={value}
                    onClick={() => setRating(value)}
                    aria-label={`${value} star`}
                  >
                    <Star
                      size={20}
                      className={value <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'}
                    />
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Comment</label>
            <textarea
              rows={3}
              maxLength={1000}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          <ErrorBanner message={error} />

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60"
            >
              {saving ? (<span className="inline-flex items-center gap-1.5"><Loader2 size={14} className="animate-spin" />Saving…</span>) : 'Submit review'}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors duration-150"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
