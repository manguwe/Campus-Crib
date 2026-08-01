import { useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'

// Status states: 'idle' | 'checking' | 'ok' | 'error'
export default function DebugConnection() {
  const [status, setStatus] = useState('idle')
  const [detail, setDetail] = useState('')

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setStatus('error')
      setDetail(
        'VITE_SUPABASE_URL and/or VITE_SUPABASE_ANON_KEY are not set. Create a .env.local file (see .env.local.example) and restart the dev server.'
      )
      return
    }

    let cancelled = false
    setStatus('checking')

    async function checkConnection() {
      try {
        const { error } = await supabase.auth.getSession()
        if (cancelled) return

        if (error) {
          setStatus('error')
          setDetail(error.message)
        } else {
          setStatus('ok')
          setDetail('Supabase client initialized and reachable.')
        }
      } catch (err) {
        if (cancelled) return
        setStatus('error')
        setDetail(err instanceof Error ? err.message : String(err))
      }
    }

    checkConnection()
    return () => {
      cancelled = true
    }
  }, [])

  const statusStyles = {
    idle: 'bg-gray-100 text-gray-700',
    checking: 'bg-yellow-100 text-yellow-800',
    ok: 'bg-green-100 text-green-800',
    error: 'bg-red-100 text-red-800',
  }

  const statusLabel = {
    idle: 'Idle',
    checking: 'Checking connection…',
    ok: 'Connected',
    error: 'Not connected',
  }

  return (
    <div className="max-w-xl w-full mx-auto bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Supabase Connection Test</h2>
      <p className="text-sm text-gray-500 mb-4">
        Confirms the frontend can reach your Supabase project using the credentials in{' '}
        <code className="bg-gray-100 px-1 rounded">.env.local</code>.
      </p>

      <div
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${statusStyles[status]}`}
      >
        <span
          className={`h-2 w-2 rounded-full ${
            status === 'ok' ? 'bg-green-500' : status === 'error' ? 'bg-red-500' : 'bg-yellow-500'
          }`}
        />
        {statusLabel[status]}
      </div>

      {detail && <p className="mt-3 text-sm text-gray-600 break-words">{detail}</p>}

      <div className="mt-4 text-xs text-gray-400">
        Project URL:{' '}
        <span className="font-mono">{import.meta.env.VITE_SUPABASE_URL || 'not set'}</span>
      </div>
    </div>
  )
}
