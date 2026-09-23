import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useCampuses } from '../../context/CampusesContext'
import { formatSupabaseError } from '../../lib/errorMessages'
import LocationPicker from '../LocationPicker'
import PageLoading from '../ui/PageLoading'
import ErrorBanner from '../ui/ErrorBanner'

const emptyForm = { name: '', latitude: '', longitude: '' }

export default function AdminCampuses() {
  // useCampuses() only ever holds active campuses (that's the list the
  // rest of the app needs), so this screen keeps its own full list
  // (active + inactive) rather than reusing that context directly -
  // refresh() is still called after every change to keep the shared
  // active-only list in sync for the rest of the app.
  const { refresh: refreshSharedCampuses } = useCampuses()

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)

  const [editingId, setEditingId] = useState(null) // null = not editing, 'new' = adding
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    setError('')
    const { data, error } = await supabase
      .from('campuses')
      .select('id, name, latitude, longitude, is_active, created_at')
      .order('name', { ascending: true })

    if (error) setError(formatSupabaseError(error, 'Could not load campuses.'))
    else setRows(data || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function startAdd() {
    setForm(emptyForm)
    setEditingId('new')
  }

  function startEdit(row) {
    setForm({ name: row.name, latitude: String(row.latitude), longitude: String(row.longitude) })
    setEditingId(row.id)
  }

  function cancelEdit() {
    setEditingId(null)
    setForm(emptyForm)
    setError('')
  }

  async function handleSave(e) {
    e.preventDefault()
    setError('')

    if (!form.name.trim()) {
      setError('Please enter a campus name.')
      return
    }
    if (form.latitude === '' || form.longitude === '') {
      setError('Please set a location on the map.')
      return
    }

    setSaving(true)
    const payload = {
      name: form.name.trim(),
      latitude: Number(form.latitude),
      longitude: Number(form.longitude),
    }

    const { error: saveError } =
      editingId === 'new'
        ? await supabase.from('campuses').insert(payload)
        : await supabase.from('campuses').update(payload).eq('id', editingId)

    setSaving(false)

    if (saveError) {
      setError(formatSupabaseError(saveError, 'Could not save this campus.'))
      return
    }

    cancelEdit()
    await load()
    refreshSharedCampuses()
  }

  async function toggleActive(row) {
    setBusyId(row.id)
    const { error: updateError } = await supabase
      .from('campuses')
      .update({ is_active: !row.is_active })
      .eq('id', row.id)
    setBusyId(null)

    if (updateError) {
      setError(formatSupabaseError(updateError, 'Could not update this campus.'))
      return
    }
    await load()
    refreshSharedCampuses()
  }

  if (loading) return <PageLoading label="Loading campuses…" />

  return (
    <div className="space-y-6">
      <ErrorBanner message={error} />

      {editingId ? (
        <form onSubmit={handleSave} className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
          <p className="text-sm font-medium text-gray-900">
            {editingId === 'new' ? 'Add a campus' : 'Edit campus'}
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => updateField('name', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          <LocationPicker
            latitude={form.latitude}
            longitude={form.longitude}
            onPick={(lat, lng) => setForm((prev) => ({ ...prev, latitude: lat, longitude: lng }))}
            onUseMyLocation={() => {
              if (!navigator.geolocation) {
                setError('Geolocation is not available in this browser.')
                return
              }
              navigator.geolocation.getCurrentPosition(
                (pos) =>
                  setForm((prev) => ({
                    ...prev,
                    latitude: pos.coords.latitude.toFixed(6),
                    longitude: pos.coords.longitude.toFixed(6),
                  })),
                (err) => setError(formatSupabaseError(err, 'Could not get your location.'))
              )
            }}
          />

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark disabled:opacity-60"
            >
              {saving ? (
                <span className="inline-flex items-center gap-1.5">
                  <Loader2 size={14} className="animate-spin" />
                  Saving…
                </span>
              ) : (
                'Save'
              )}
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              className="text-sm font-medium text-gray-500 hover:underline"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={startAdd}
          className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark"
        >
          Add campus
        </button>
      )}

      <div className="space-y-2">
        {rows.map((r) => (
          <div
            key={r.id}
            className={`bg-white rounded-2xl border p-4 flex items-center justify-between gap-3 ${
              r.is_active ? 'border-gray-200' : 'border-gray-200 opacity-60'
            }`}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium text-gray-900 truncate">{r.name}</p>
                {!r.is_active && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                    Inactive
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                {r.latitude.toFixed(6)}, {r.longitude.toFixed(6)}
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={() => startEdit(r)}
                className="text-sm font-medium text-gray-700 hover:underline"
              >
                Edit
              </button>
              <button
                onClick={() => toggleActive(r)}
                disabled={busyId === r.id}
                className={`text-sm font-medium hover:underline disabled:opacity-50 ${
                  r.is_active ? 'text-red-600' : 'text-accent'
                }`}
              >
                {r.is_active ? 'Deactivate' : 'Reactivate'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
