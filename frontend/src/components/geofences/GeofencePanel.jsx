import { useEffect, useState } from 'react'
import { api } from '../../api/client'
import toast from 'react-hot-toast'
import { Plus, MapPin, X, RefreshCw, AlertCircle, Loader } from 'lucide-react'

const CATEGORIES = ['residential', 'commercial', 'industrial', 'restricted', 'warehouse', 'other']
const COLORS = ['bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-red-500', 'bg-violet-500', 'bg-pink-500', 'bg-cyan-500', 'bg-orange-500']

const SAMPLE_COORDS = '[[77.58, 12.89], [77.65, 12.89], [77.65, 12.95], [77.58, 12.95], [77.58, 12.89]]'

export default function GeofencePanel({ onGeofencesChange }) {
  const [geofences, setGeofences] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [form, setForm] = useState({
    geofence_name: '',
    category: '',
    description: '',
    coordinates: '',
  })

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.listGeofences(filter || undefined)
      console.log('[GeofencePanel] Loaded:', data)
      const list = Array.isArray(data) ? data : []
      setGeofences(list)
      onGeofencesChange?.(list)
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to load geofences'
      console.error('[GeofencePanel] Error:', msg)
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [filter])

  const reset = () => {
    setForm({ geofence_name: '', category: '', description: '', coordinates: '' })
    setShowForm(false)
    setError(null)
  }

  const validateCoordinates = (coordStr) => {
    try {
      const coords = JSON.parse(coordStr)
      if (!Array.isArray(coords)) {
        throw new Error('Must be an array')
      }
      if (coords.length < 4) {
        throw new Error('Need at least 4 points for a polygon')
      }
      const first = coords[0]
      const last = coords[coords.length - 1]
      if (first[0] !== last[0] || first[1] !== last[1]) {
        throw new Error('Polygon must be closed (first and last point must match)')
      }
      for (const [lng, lat] of coords) {
        if (typeof lng !== 'number' || typeof lat !== 'number') {
          throw new Error('Each coordinate must be [longitude, latitude]')
        }
        if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
          throw new Error('Invalid latitude/longitude ranges')
        }
      }
      return { coords, error: null }
    } catch (err) {
      return { coords: null, error: `Invalid coordinates: ${err.message}` }
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    if (!form.geofence_name.trim()) {
      setError('Geofence name is required')
      return
    }
    if (!form.coordinates.trim()) {
      setError('Coordinates are required')
      return
    }

    const { coords, error: coordError } = validateCoordinates(form.coordinates)
    if (coordError) {
      setError(coordError)
      return
    }

    setSubmitting(true)
    try {
      await api.createGeofence({
        geofence_name: form.geofence_name,
        category: form.category || '',
        description: form.description || '',
        coordinates: coords,
      })
      toast.success(`✅ Geofence "${form.geofence_name}" created`)
      reset()
      load()
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to create geofence'
      setError(msg)
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* ── Header ── */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-gray-100 sticky top-0 bg-white/80 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <MapPin size={16} className="text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Geofences</h3>
              <p className="text-xs text-gray-500">{geofences.length} zones defined</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={filter}
              onChange={e => setFilter(e.target.value)}
              className="text-xs px-2.5 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:border-gray-300 transition-colors"
            >
              <option value="">All categories</option>
              {CATEGORIES.map(c => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <button
              onClick={load}
              disabled={loading}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw size={16} className={`text-gray-600 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors"
            >
              {showForm ? <X size={14} /> : <Plus size={14} />}
              {showForm ? 'Cancel' : 'New'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Create Form ── */}
      {showForm && (
        <div className="flex-shrink-0 px-4 py-3 border-b border-blue-100 bg-blue-50/50">
          <form onSubmit={handleSubmit} className="space-y-3">
            {error && (
              <div className="flex items-start gap-2 p-2.5 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle size={14} className="text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-700">{error}</p>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Warehouse Zone"
                  value={form.geofence_name}
                  onChange={e => setForm(f => ({ ...f, geofence_name: e.target.value }))}
                  className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select category…</option>
                  {CATEGORIES.map(c => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  placeholder="Optional"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-gray-700">
                  Coordinates (JSON) <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, coordinates: SAMPLE_COORDS }))}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  Use sample
                </button>
              </div>
              <textarea
                required
                placeholder='[[77.58, 12.89], [77.65, 12.89], [77.65, 12.95], [77.58, 12.95], [77.58, 12.89]]'
                value={form.coordinates}
                onChange={e => setForm(f => ({ ...f, coordinates: e.target.value }))}
                className="w-full px-3 py-2 text-xs font-mono border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none h-16"
              />
              <p className="text-xs text-gray-500 mt-1">Format: [[lng, lat], ...] with closed polygon (first = last)</p>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={reset}
                className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Clear
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-lg transition-colors"
              >
                {submitting && <Loader size={12} className="animate-spin" />}
                {submitting ? 'Creating...' : 'Create Geofence'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {loading && !geofences.length ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <Loader size={24} className="mb-2 animate-spin" />
            <p className="text-sm">Loading geofences...</p>
          </div>
        ) : geofences.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <MapPin size={24} className="mb-2 opacity-50" />
            <p className="text-sm">No geofences yet</p>
            <p className="text-xs mt-1">Click "New" to create one</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {geofences.map((g, idx) => (
              <div
                key={g.geofence_id}
                className="p-3 border border-gray-100 rounded-lg hover:border-gray-200 hover:shadow-sm transition-all bg-gray-50/50"
              >
                <div className="flex items-start gap-2.5">
                  <div className={`w-3 h-3 rounded-full flex-shrink-0 mt-1 ${COLORS[idx % COLORS.length]}`} />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm text-gray-900 truncate">{g.geofence_name}</h4>
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      {g.category && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                          {g.category}
                        </span>
                      )}
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs text-gray-600 bg-gray-100">
                        {g.coordinates?.length || 0} pts
                      </span>
                    </div>
                    {g.description && (
                      <p className="text-xs text-gray-500 mt-1.5 line-clamp-2">{g.description}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

