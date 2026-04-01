import { useEffect, useState } from 'react'
import { api } from '../../api/client'
import toast from 'react-hot-toast'
import { Plus, Car, Navigation, RefreshCw, X, Trash2 } from 'lucide-react'

const VEHICLE_TYPES = ['Car', 'Truck', 'Van', 'Motorcycle', 'Bus', 'Pickup', 'Other']

export default function VehiclePanel({ onVehiclesChange }) {
  const [vehicles, setVehicles]   = useState([])
  const [loading, setLoading]     = useState(false)
  const [showForm, setShowForm]   = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    vehicle_number: '',
    driver_name: '',
    vehicle_type: 'Car',
    phone: '',
  })
  const [locForm, setLocForm] = useState({
    vehicle_id: '',
    latitude: '',
    longitude: '',
  })
  const [updatingLoc, setUpdatingLoc] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const data = await api.listVehicles()
      const list = data ?? []
      setVehicles(list)
      onVehiclesChange?.(list)
    } catch {
      toast.error('Failed to load vehicles')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, []) // eslint-disable-line

  const handleCreate = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await api.createVehicle(form)
      toast.success(`Vehicle "${form.vehicle_number}" registered`)
      setForm({ vehicle_number: '', driver_name: '', vehicle_type: 'Car', phone: '' })
      setShowForm(false)
      load()
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Failed to register vehicle')
    } finally {
      setSubmitting(false)
    }
  }

  const handleLocationUpdate = async (e) => {
    e.preventDefault()
    if (!locForm.vehicle_id || !locForm.latitude || !locForm.longitude) {
      toast.error('Fill in all location fields')
      return
    }
    setUpdatingLoc(true)
    try {
      const result = await api.updateLocation({
        vehicle_id: parseInt(locForm.vehicle_id, 10),
        latitude:   parseFloat(locForm.latitude),
        longitude:  parseFloat(locForm.longitude),
      })
      const inside = result.active_geofences?.length ?? 0
      toast.success(
        inside > 0
          ? `Location updated — inside ${inside} geofence(s)`
          : 'Location updated — outside all geofences'
      )
      setLocForm({ vehicle_id: '', latitude: '', longitude: '' })
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Failed to update location')
    } finally {
      setUpdatingLoc(false)
    }
  }

  const handleDelete = async (vehicle) => {
    if (!window.confirm(`Delete vehicle "${vehicle.vehicle_number}" (${vehicle.driver_name})? This cannot be undone.`)) {
      return
    }

    try {
      await api.deleteVehicle(vehicle.vehicle_id)
      toast.success(`Deleted "${vehicle.vehicle_number}"`)
      load()
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Failed to delete vehicle')
    }
  }

  return (
    <div className="p-4 h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
          <Car size={15} className="text-blue-600" />
          Vehicles
          <span className="text-xs text-gray-400 font-normal">({vehicles.length})</span>
        </h2>
        <div className="flex gap-2">
          <button onClick={load} className="btn-secondary py-2 px-2">
            <RefreshCw size={14} />
          </button>
          <button onClick={() => setShowForm(s => !s)} className="btn-primary flex items-center gap-1 text-sm">
            {showForm ? <X size={14} /> : <Plus size={14} />}
            {showForm ? 'Cancel' : 'Register'}
          </button>
        </div>
      </div>

      {/* Register form */}
      {showForm && (
        <form
          onSubmit={handleCreate}
          className="bg-blue-50 border border-blue-100 rounded-xl p-3 mb-3 grid grid-cols-4 gap-2"
        >
          <div>
            <label className="label">Vehicle No. <span className="text-red-500">*</span></label>
            <input className="input" required placeholder="KA01AB1234" value={form.vehicle_number}
              onChange={e => setForm(f => ({ ...f, vehicle_number: e.target.value }))} />
          </div>
          <div>
            <label className="label">Driver Name <span className="text-red-500">*</span></label>
            <input className="input" required placeholder="Ravi Kumar" value={form.driver_name}
              onChange={e => setForm(f => ({ ...f, driver_name: e.target.value }))} />
          </div>
          <div>
            <label className="label">Type</label>
            <select className="input" value={form.vehicle_type}
              onChange={e => setForm(f => ({ ...f, vehicle_type: e.target.value }))}>
              {VEHICLE_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Phone</label>
            <input className="input" placeholder="9876543210" value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
          </div>
          <div className="col-span-4 flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary text-sm">Cancel</button>
            <button type="submit" disabled={submitting} className="btn-primary text-sm">
              {submitting ? 'Registering…' : 'Register Vehicle'}
            </button>
          </div>
        </form>
      )}

      {/* Manual location update */}
      <form
        onSubmit={handleLocationUpdate}
        className="bg-gray-50 border border-gray-200 rounded-xl p-3 mb-3 flex items-end gap-2 flex-wrap"
      >
        <div className="flex items-center gap-1 text-xs font-semibold text-gray-600 w-full -mb-1">
          <Navigation size={12} /> Manual location update
        </div>
        <div className="flex-1 min-w-[120px]">
          <label className="label">Vehicle</label>
          <select className="input text-xs" value={locForm.vehicle_id}
            onChange={e => setLocForm(l => ({ ...l, vehicle_id: e.target.value }))}>
            <option value="">Select vehicle…</option>
            {vehicles.map(v => (
              <option key={v.vehicle_id} value={v.vehicle_id}>{v.vehicle_number}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Latitude</label>
          <input className="input w-28 text-xs" type="number" step="any" placeholder="12.9716"
            value={locForm.latitude}
            onChange={e => setLocForm(l => ({ ...l, latitude: e.target.value }))} />
        </div>
        <div>
          <label className="label">Longitude</label>
          <input className="input w-28 text-xs" type="number" step="any" placeholder="77.5946"
            value={locForm.longitude}
            onChange={e => setLocForm(l => ({ ...l, longitude: e.target.value }))} />
        </div>
        <button type="submit" disabled={updatingLoc} className="btn-primary text-xs py-2 shrink-0">
          {updatingLoc ? '…' : 'Update'}
        </button>
      </form>

      {/* Vehicle list */}
      {loading ? (
        <div className="flex items-center justify-center py-6 text-gray-400 text-sm gap-2">
          <RefreshCw size={14} className="animate-spin" /> Loading…
        </div>
      ) : vehicles.length === 0 ? (
        <div className="text-center py-6 text-gray-400 text-sm">No vehicles registered yet.</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {vehicles.map(v => (
            <div key={v.vehicle_id} className="card p-3 group hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-1">
                <p className="font-semibold text-sm text-gray-900 truncate">{v.vehicle_number}</p>
                <button
                  onClick={() => handleDelete(v)}
                  className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                  title="Delete vehicle"
                >
                  <Trash2 size={12} />
                </button>
              </div>
              <span className="badge-gray shrink-0 text-xs">{v.vehicle_type}</span>
              <p className="text-xs text-gray-600 truncate mt-1">{v.driver_name}</p>
              <p className="text-xs text-gray-400">{v.phone || '—'}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
