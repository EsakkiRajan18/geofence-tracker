import { useState, useCallback, useEffect } from 'react'
import toast from 'react-hot-toast'
import { MapPin, Bell, Car, History, Wifi, WifiOff, AlertTriangle } from 'lucide-react'
import GeofencePanel from './components/geofences/GeofencePanel'
import VehiclePanel from './components/vehicles/VehiclePanel'
import AlertPanel from './components/alerts/AlertPanel'
import ViolationPanel from './components/violations/ViolationPanel'
import MainMap from './components/map/MainMap'
import AlertFeed from './components/alerts/AlertFeed'
import { useAlertSocket } from './hooks/useAlertSocket'
import { api } from './api/client'

const TABS = [
  { id: 'geofences', label: 'Geofences', icon: MapPin },
  { id: 'vehicles',  label: 'Vehicles',  icon: Car },
  { id: 'alerts',    label: 'Alerts',    icon: Bell },
  { id: 'history',   label: 'History',   icon: History },
]

export default function App() {
  const [tab, setTab] = useState('geofences')
  const [alerts, setAlerts] = useState([])
  const [geofences, setGeofences] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [loadingMap, setLoadingMap] = useState(true)

  // Load geofences and vehicles on mount
  useEffect(() => {
    const load = async() => {
      try {
        const [geos, vees] = await Promise.all([
          api.listGeofences(),
          api.listVehicles(),
        ])
        console.log('[App] Loaded geofences:', geos?.length || 0)
        console.log('[App] Loaded vehicles:', vees?.length || 0)
        setGeofences(geos || [])
        setVehicles(vees || [])
      } catch (err) {
        console.error('[App] Failed to load data:', err)
        toast.error('Failed to load geofences and vehicles')
      } finally {
        setLoadingMap(false)
      }
    }
    load()
  }, [])

  const handleAlert = useCallback((msg) => {
    setAlerts(prev => [msg, ...prev].slice(0, 50))
    const isEntry = msg.event_type === 'entry'
    toast.custom(
      (t) => (
        <div
          className={`flex items-start gap-3 bg-white border-l-4 ${
            isEntry ? 'border-green-500' : 'border-red-500'
          } rounded-xl shadow-lg p-4 max-w-sm cursor-pointer`}
          onClick={() => toast.dismiss(t.id)}
        >
          <div className={`mt-0.5 shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
            isEntry ? 'bg-green-100' : 'bg-red-100'
          }`}>
            <AlertTriangle size={14} className={isEntry ? 'text-green-600' : 'text-red-600'} />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm text-gray-900">
              {isEntry ? '🟢 Zone Entry' : '🔴 Zone Exit'}
            </p>
            <p className="text-xs text-gray-600 mt-0.5 truncate">
              <span className="font-medium">{msg.vehicle.vehicle_number}</span>
              {' → '}
              {msg.geofence.geofence_name}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              {msg.vehicle.driver_name} · {msg.geofence.category}
            </p>
          </div>
        </div>
      ),
      { duration: 6000 }
    )
  }, [])

  // Update geofences when GeofencePanel loads them
  const handleGeofencesChange = useCallback((geos) => {
    console.log('[App] GeofencePanel updated geofences:', geos?.length || 0)
    setGeofences(geos || [])
  }, [])

  // Update vehicles when VehiclePanel loads them
  const handleVehiclesChange = useCallback((vees) => {
    console.log('[App] VehiclePanel updated vehicles:', vees?.length || 0)
    setVehicles(vees || [])
  }, [])

  const { connected } = useAlertSocket(handleAlert)

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100">
      {/* ── Sidebar ── */}
      <aside className="w-64 shrink-0 flex flex-col bg-white border-r border-gray-200 shadow-sm z-10">
        {/* Logo */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-sm">
              <MapPin size={18} className="text-white" />
            </div>
            <div>
              <h1 className="font-bold text-gray-900 leading-tight">GeoFence</h1>
              <p className="text-xs text-gray-400">Vehicle Tracker</p>
            </div>
          </div>
          {/* WebSocket status pill */}
          <div className={`mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
            connected
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-gray-100 text-gray-500 border border-gray-200'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
            {connected ? 'Live alerts on' : 'Reconnecting…'}
          </div>
        </div>

        {/* Nav */}
        <nav className="p-3 space-y-0.5">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                tab === id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </nav>

        {/* Alert feed — fills remaining space */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <AlertFeed alerts={alerts} />
        </div>
      </aside>

      {/* ── Main area ── */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Map */}
        <div className="flex-1 min-h-0 relative bg-gray-50">
          {loadingMap ? (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-50">
              <div className="text-center">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <div className="w-8 h-8 border-2 border-blue-600 border-t-blue-300 rounded-full animate-spin" />
                </div>
                <p className="text-sm text-gray-600 font-medium">Loading map...</p>
                <p className="text-xs text-gray-500 mt-1">{geofences.length} geofences, {vehicles.length} vehicles</p>
              </div>
            </div>
          ) : (
            <MainMap geofences={geofences} vehicles={vehicles} />
          )}
        </div>

        {/* Bottom panel */}
        <div className="h-72 shrink-0 bg-white border-t border-gray-200 overflow-y-auto">
          {tab === 'geofences' && <GeofencePanel onGeofencesChange={handleGeofencesChange} />}
          {tab === 'vehicles'  && <VehiclePanel  onVehiclesChange={handleVehiclesChange} />}
          {tab === 'alerts'    && <AlertPanel />}
          {tab === 'history'   && <ViolationPanel />}
        </div>
      </main>
    </div>
  )
}
