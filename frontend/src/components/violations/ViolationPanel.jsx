import { useEffect, useState } from 'react'
import { api } from '../../api/client'
import toast from 'react-hot-toast'
import { History, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'
import { format } from 'date-fns'

export default function ViolationPanel() {
  const [events, setEvents]     = useState([])
  const [total, setTotal]       = useState(0)
  const [page, setPage]         = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading]   = useState(false)
  const [geofences, setGeofences] = useState([])
  const [vehicles, setVehicles]   = useState([])
  const [filters, setFilters] = useState({
    vehicle_id: '',
    geofence_id: '',
    from: '',
    to: '',
  })

  useEffect(() => {
    api.listGeofences().then(d => setGeofences(d ?? []))
    api.listVehicles().then(d => setVehicles(d ?? []))
  }, [])

  const load = async () => {
    setLoading(true)
    try {
      const params = { page, page_size: 10 }
      if (filters.vehicle_id)  params.vehicle_id  = filters.vehicle_id
      if (filters.geofence_id) params.geofence_id = filters.geofence_id
      if (filters.from) params.from = new Date(filters.from).toISOString()
      if (filters.to)   params.to   = new Date(filters.to + 'T23:59:59').toISOString()
      const data = await api.listViolations(params)
      setEvents(data.data ?? [])
      setTotal(data.total ?? 0)
      setTotalPages(data.total_pages ?? 1)
    } catch {
      toast.error('Failed to load history')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [page, filters]) // eslint-disable-line

  const setFilter = (key, val) => {
    setFilters(f => ({ ...f, [key]: val }))
    setPage(1)
  }

  return (
    <div className="p-4 h-full flex flex-col">
      {/* Header + filters */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
          <History size={15} className="text-blue-600" />
          Violation History
          <span className="text-xs text-gray-400 font-normal">({total} total)</span>
        </h2>
        <div className="flex gap-2 flex-wrap items-center">
          <select className="input w-32 text-xs" value={filters.vehicle_id}
            onChange={e => setFilter('vehicle_id', e.target.value)}>
            <option value="">All vehicles</option>
            {vehicles.map(v => (
              <option key={v.vehicle_id} value={v.vehicle_id}>{v.vehicle_number}</option>
            ))}
          </select>
          <select className="input w-36 text-xs" value={filters.geofence_id}
            onChange={e => setFilter('geofence_id', e.target.value)}>
            <option value="">All geofences</option>
            {geofences.map(g => (
              <option key={g.geofence_id} value={g.geofence_id}>{g.geofence_name}</option>
            ))}
          </select>
          <input type="date" className="input w-32 text-xs" value={filters.from}
            onChange={e => setFilter('from', e.target.value)} />
          <span className="text-xs text-gray-400">to</span>
          <input type="date" className="input w-32 text-xs" value={filters.to}
            onChange={e => setFilter('to', e.target.value)} />
          <button onClick={load} className="btn-secondary py-2 px-2">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-gray-400 text-sm gap-2">
            <RefreshCw size={14} className="animate-spin" /> Loading…
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">No events match your filters.</div>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-xs text-gray-500 bg-gray-50">
                <th className="px-3 py-2 font-medium rounded-tl-lg">Time</th>
                <th className="px-3 py-2 font-medium">Vehicle</th>
                <th className="px-3 py-2 font-medium">Driver</th>
                <th className="px-3 py-2 font-medium">Geofence</th>
                <th className="px-3 py-2 font-medium">Event</th>
                <th className="px-3 py-2 font-medium rounded-tr-lg">Coordinates</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {events.map(e => (
                <tr key={e.event_id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">
                    {format(new Date(e.occurred_at), 'MMM d, HH:mm:ss')}
                  </td>
                  <td className="px-3 py-2">
                    <span className="font-medium text-xs text-gray-900">{e.vehicle_number}</span>
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-600">{e.driver_name}</td>
                  <td className="px-3 py-2">
                    <p className="text-xs font-medium text-gray-900 truncate max-w-[140px]">
                      {e.geofence_name}
                    </p>
                    {e.category && <span className="badge-gray text-[10px]">{e.category}</span>}
                  </td>
                  <td className="px-3 py-2">
                    {e.event_type === 'entry'
                      ? <span className="badge-green">↘ Entry</span>
                      : <span className="badge-red">↗ Exit</span>}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-400 font-mono whitespace-nowrap">
                    {e.latitude.toFixed(4)}, {e.longitude.toFixed(4)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100">
        <p className="text-xs text-gray-500">
          Page {page} of {totalPages} · {total} event{total !== 1 ? 's' : ''}
        </p>
        <div className="flex gap-1">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="btn-secondary py-1.5 px-2 disabled:opacity-40"
          >
            <ChevronLeft size={14} />
          </button>
          {/* Page numbers */}
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            const pg = Math.max(1, Math.min(page - 2, totalPages - 4)) + i
            return (
              <button
                key={pg}
                onClick={() => setPage(pg)}
                className={`py-1.5 px-2.5 rounded-lg text-xs font-medium ${
                  pg === page
                    ? 'bg-blue-600 text-white'
                    : 'btn-secondary'
                }`}
              >
                {pg}
              </button>
            )
          })}
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="btn-secondary py-1.5 px-2 disabled:opacity-40"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
