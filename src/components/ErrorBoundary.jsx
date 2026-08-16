import { Component } from 'react'
import { AlertTriangle } from 'lucide-react'
import { logActivity } from '../lib/activityLog'

// Error boundaries must be class components - React has no hook
// equivalent for catching render errors in a subtree (as of React 18).
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    // Logged to the console so it's still visible during development /
    // debugging, without taking the whole page down.
    console.error('Caught by ErrorBoundary:', error, errorInfo)

    // Also logged to activity_logs (fire-and-forget - see activityLog.js)
    // so an admin can see exactly what a user was doing right before a
    // crash, from the Users tab's per-user activity timeline.
    logActivity('error', {
      path: typeof window !== 'undefined' ? window.location.pathname : null,
      details: {
        message: error?.message || String(error),
        stack: error?.stack || null,
        componentStack: errorInfo?.componentStack || null,
      },
    })
  }

  handleReload = () => {
    window.location.href = '/'
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <div className="max-w-sm w-full bg-white rounded-2xl border border-gray-200 shadow-sm p-6 text-center">
            <div className="inline-flex bg-red-50 rounded-full p-3 mb-3">
              <AlertTriangle size={22} className="text-red-500" />
            </div>
            <p className="font-medium text-gray-900">Something went wrong</p>
            <p className="text-sm text-gray-500 mt-1">
              This page ran into an unexpected error. Try reloading — if it keeps happening, please
              let us know what you were doing.
            </p>
            <button
              onClick={this.handleReload}
              className="mt-4 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark transition-all duration-150 hover:scale-[1.02] active:scale-[0.98]"
            >
              Back to home
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
