import { useEffect, useState } from 'react'
import { api } from '../../api/client'
import toast from 'react-hot-toast'
import { Bell, Plus, X, RefreshCw, CheckCircle } from 'lucide-react'

export default function AlertPanel() {
  const [alerts, setAlerts]       = useState([])
  const [geofences, setGeofences] = useState([])
  const [vehicles, setVehicles]   = useState([])
  const [loading, setLoading]     = useState(false)
  const [showForm, setShowForm]   = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    geofence_id: '',
    vehicle_id: '',
    event_type: 'both',
  })
  const [filterGF, setFilterGF] = useState('')
  const [filterVH, setFilterVH] = useState('')

  useEffect(() => {
    api.listGeofences().then(d => setGeofences(d ?? []))
    api.listVehicles().then(d => setVehicles(d ?? []))
    load()
  }, []) // eslint-disable-line

  const load = async () => {
    setLoading(true)
    try {
      const params = {}
      if (filterGF) params.geofence_id = filterGF
      if (filterVH) params.vehicle_id  = filterVH
      setAlerts((await api.listAlerts(params)) ?? [])
    } catch {
      toast.error('Failed to load alerts')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [filterGF, filterVH]) // eslint-disable-line

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.geofence_id) { toast.error('Select a geofence'); return }
    setSubmitting(true)
    try {
      const body = {
        geofence_id: parseInt(form.geofence_id, 10),
        event_type:  form.event_type,
      }
      if (form.vehicle_id) body.vehicle_id = parseInt(form.vehicle_id, 10)
      await api.configureAlert(body)
      toast.success('Alert rule configured')
      setShowForm(false)
      setForm({ geofence_id: '', vehicle_id: '', event_type: 'both' })
      load()
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Failed to configure alert')
    } finally {
      setSubmitting(false)
    }
  }

  const eventTag = (t) => {
    if (t === 'entry') return <span className="badge-green">Entry</span>
    if (t === 'exit')  return <span className="badge-red">Exit</span>
    return <span className="badge-blue">Both</span>
  }

  return (
    <div className="p-4 h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
          <Bell size={15} className="text-blue-600" />
          Alert Rules
          <span className="text-xs text-gray-400 font-normal">({alerts.length})</span>
        </h2>
        <div className="flex gap-2">
          <select className="input w-36 text-xs" value={filterGF}
            onChange={e => setFilterGF(e.target.value)}>
            <option value="">All geofences</option>
            {geofences.map(g => (
              <option key={g.geofence_id} value={g.geofence_id}>{g.geofence_name}</option>
            ))}
          </select>
          <select className="input w-32 text-xs" value={filterVH}
            onChange={e => setFilterVH(e.target.value)}>
            <option value="">All vehicles</option>
            {vehicles.map(v => (
              <option key={v.vehicle_id} value={v.vehicle_id}>{v.vehicle_number}</option>
            ))}
          </select>
          <button onClick={load} className="btn-secondary py-2 px-2">
            <RefreshCw size={14} />
          </button>
          <button onClick={() => setShowForm(s => !s)} className="btn-primary flex items-center gap-1 text-sm">
            {showForm ? <X size={14} /> : <Plus size={14} />}
            {showForm ? 'Cancel' : 'New Rule'}
          </button>
        </div>
      </div>

      {/* Create form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-blue-50 border border-blue-100 rounded-xl p-3 mb-3 grid grid-cols-3 gap-3"
        >
          <div>
            <label className="label">Geofence <span className="text-red-500">*</span></label>
            <select className="input" required value={form.geofence_id}
              onChange={e => setForm(f => ({ ...f, geofence_id: e.target.value }))}>
              <option value="">Select geofence…</option>
              {geofences.map(g => (
                <option key={g.geofence_id} value={g.geofence_id}>{g.geofence_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Vehicle <span className="text-gray-400 font-normal text-xs">(optional — all if blank)</span></label>
            <select className="input" value={form.vehicle_id}
              onChange={e => setForm(f => ({ ...f, vehicle_id: e.target.value }))}>
              <option value="">All vehicles</option>
              {vehicles.map(v => (
                <option key={v.vehicle_id} value={v.vehicle_id}>{v.vehicle_number}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Trigger on</label>
            <select className="input" value={form.event_type}
              onChange={e => setForm(f => ({ ...f, event_type: e.target.value }))}>
              <option value="entry">Entry only</option>
              <option value="exit">Exit only</option>
              <option value="both">Both entry & exit</option>
            </select>
          </div>
          <div className="col-span-3 flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary text-sm">Cancel</button>
            <button type="submit" disabled={submitting} className="btn-primary text-sm">
              {submitting ? 'Saving…' : 'Save Rule'}
            </button>
          </div>
        </form>
      )}

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-6 text-gray-400 text-sm gap-2">
          <RefreshCw size={14} className="animate-spin" /> Loading…
        </div>
      ) : alerts.length === 0 ? (
        <div className="text-center py-6 text-gray-400 text-sm">
          No alert rules yet. Create one to start receiving real-time notifications.
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {alerts.map(a => (
            <div key={a.alert_id} className="card p-3">
              <div className="flex items-center justify-between mb-1.5">
                {eventTag(a.event_type)}
                <div className="flex items-center gap-1">
                  {a.is_active
                    ? <CheckCircle size={12} className="text-green-500" />
                    : <X size={12} className="text-gray-400" />}
                  <span className="text-xs text-gray-400">{a.is_active ? 'Active' : 'Off'}</span>
                </div>
              </div>
              <p className="text-sm font-medium text-gray-900 truncate">{a.geofence_name}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {a.vehicle_number || <span className="italic text-gray-400">All vehicles</span>}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
