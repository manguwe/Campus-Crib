import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import AdminOverview from '../components/admin/AdminOverview'
import AdminVerifications from '../components/admin/AdminVerifications'
import AdminProperties from '../components/admin/AdminProperties'
import AdminUsers from '../components/admin/AdminUsers'
import AdminFeedback from '../components/admin/AdminFeedback'
import AdminContactMessages from '../components/admin/AdminContactMessages'
import AdminReports from '../components/admin/AdminReports'
import AdminTraffic from '../components/admin/AdminTraffic'
import AdminAiUsage from '../components/admin/AdminAiUsage'
import AdminCampuses from '../components/admin/AdminCampuses'
import AdminAnnouncements from '../components/admin/AdminAnnouncements'

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'traffic', label: 'Traffic' },
  { id: 'ai-usage', label: 'AI Usage' },
  { id: 'verifications', label: 'Landlord verifications', countKey: 'verifications' },
  { id: 'properties', label: 'Properties', countKey: 'properties' },
  { id: 'campuses', label: 'Campuses' },
  { id: 'users', label: 'Users' },
  { id: 'feedback', label: 'Feedback', countKey: 'feedback' },
  { id: 'contact', label: 'Contact', countKey: 'contact' },
  { id: 'reports', label: 'Reports', countKey: 'reports' },
  { id: 'announcements', label: 'Announcements' },
]

const EMPTY_COUNTS = { verifications: 0, properties: 0, feedback: 0, contact: 0, reports: 0 }

export default function AdminDashboard() {
  const { profile } = useAuth()
  const [tab, setTab] = useState('overview')
  const [counts, setCounts] = useState(EMPTY_COUNTS)

  async function loadCounts() {
    const [verifications, properties, feedback, contact, reports] = await Promise.all([
      supabase
        .from('landlord_profiles')
        .select('id', { count: 'exact', head: true })
        .eq('verification_status', 'pending'),
      supabase.from('properties').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('feedback').select('id', { count: 'exact', head: true }).eq('is_read', false),
      supabase.from('contact_messages').select('id', { count: 'exact', head: true }).eq('is_read', false),
      supabase.from('property_reports').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    ])

    setCounts({
      verifications: verifications.count ?? 0,
      properties: properties.count ?? 0,
      feedback: feedback.count ?? 0,
      contact: contact.count ?? 0,
      reports: reports.count ?? 0,
    })
  }

  // Refetches on every tab switch (so acting on an item in one tab
  // updates the badge as soon as the admin navigates away and back) plus
  // a light 30s interval, rather than prop-drilling a refresh callback
  // into five separate admin components for instant updates.
  useEffect(() => {
    loadCounts()
  }, [tab])

  useEffect(() => {
    const interval = setInterval(loadCounts, 30000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-lg font-semibold text-primary">Admin dashboard</h1>
        <p className="text-sm text-gray-500">Logged in as {profile?.name}</p>
      </div>

      <div className="flex gap-2 border-b border-gray-200 overflow-x-auto">
        {TABS.map((t) => {
          const count = t.countKey ? counts[t.countKey] : 0
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap shrink-0 ${
                tab === t.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
              {count > 0 && (
                <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full bg-red-500 text-white text-xs font-medium">
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {tab === 'overview' && <AdminOverview />}
      {tab === 'traffic' && <AdminTraffic />}
      {tab === 'ai-usage' && <AdminAiUsage />}
      {tab === 'verifications' && <AdminVerifications />}
      {tab === 'properties' && <AdminProperties />}
      {tab === 'campuses' && <AdminCampuses />}
      {tab === 'users' && <AdminUsers />}
      {tab === 'feedback' && <AdminFeedback />}
      {tab === 'contact' && <AdminContactMessages />}
      {tab === 'reports' && <AdminReports />}
      {tab === 'announcements' && <AdminAnnouncements />}
    </div>
  )
}
