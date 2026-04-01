import { useEffect, useState, useCallback, useRef } from 'react'
import {
  MapContainer, TileLayer, Polygon, Marker, Popup, useMapEvents, useMap,
} from 'react-leaflet'
import L from 'leaflet'
import 'leaflet-draw/dist/leaflet.draw.css'
import 'leaflet-draw'
import { api } from '../../api/client'
import toast from 'react-hot-toast'

// ── Fix Leaflet default icon paths ────────────────────────────────────────
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const GEOFENCE_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316',
]

function vehicleIcon(isActive, isSelected) {
  const color = isSelected ? '#fbbf24' : isActive ? '#16a34a' : '#2563eb'
  const shadow = isSelected ? '0 0 20px rgba(251, 191, 36, 0.6)' : '0 2px 8px rgba(0,0,0,0.3)'
  return L.divIcon({
    html: `
      <div style="
        position:relative;width:32px;height:32px;
        background:${color};border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);
        border:3px solid white;
        box-shadow:${shadow};
        transition: all 0.2s ease;
      ">
        <div style="
          position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
          transform:rotate(45deg);color:white;font-size:12px;
        ">🚗</div>
      </div>`,
    className: '',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -34],
  })
}

function clickedPinIcon() {
  return L.divIcon({
    html: `
      <div style="
        position:relative;width:40px;height:40px;
        background:#f59e0b;border-radius:50%;
        border:3px solid white;
        box-shadow:0 2px 8px rgba(0,0,0,0.4);
        display:flex;align-items:center;justify-content:center;
      ">📍</div>`,
    className: '',
    iconSize: [40, 40],
    iconAnchor: [20, 40],
  })
}

// ── Map Event Listeners ────────────────────────────────────────────────────
function ClickHandler({ onMapClick }) {
  const map = useMapEvents({
    click: (e) => {
      console.log('[Map] Click at:', e.latlng)
      onMapClick(e.latlng)
    }
  })
  return null
}

// ── Bounds Manager ────────────────────────────────────────────────────────
function BoundsManager({ geofences }) {
  const map = useMap()
  const fitted = useRef(false)

  useEffect(() => {
    if (fitted.current || geofences.length === 0) return
    const allPoints = geofences.flatMap(g =>
      (g.coordinates || []).map(c => [c[1], c[0]])
    )
    if (allPoints.length > 0) {
      map.fitBounds(L.latLngBounds(allPoints), { padding: [30, 30] })
      fitted.current = true
    }
  }, [geofences, map])

  return null
}

// Zoom to selected vehicle location
function VehicleZoom({ selectedVehicle, vehicleLocs }) {
  const map = useMap()

  useEffect(() => {
    if (!selectedVehicle || !vehicleLocs[selectedVehicle]) return
    const loc = vehicleLocs[selectedVehicle]
    console.log('[Map] Zooming to vehicle:', { vehicleId: selectedVehicle, lat: loc.lat, lng: loc.lng })
    map.setView([loc.lat, loc.lng], 15, { animate: true, duration: 0.8 })
  }, [selectedVehicle, vehicleLocs, map])

  return null
}

export default function MainMap({ geofences, vehicles }) {
  const [vehicleLocs, setVehicleLocs] = useState({})
  const [selectedVehicle, setSelectedVehicle] = useState(null)
  const [clickPos, setClickPos]       = useState(null)
  const [updating, setUpdating]       = useState(null)
  const [drawDialog, setDrawDialog]   = useState(null)
  const [drawName, setDrawName]       = useState('')
  const [drawCategory, setDrawCategory] = useState('')
  const [savingGeofence, setSavingGeofence] = useState(false)
  const [isDrawing, setIsDrawing] = useState(false)
  const [drawnPoints, setDrawnPoints] = useState([])

  // Log geofences on mount/change
  useEffect(() => {
    console.log('[MainMap] Received geofences:', {
      count: geofences?.length || 0,
      geofences: geofences?.map(g => ({
        id: g.geofence_id,
        name: g.geofence_name,
        coordCount: g.coordinates?.length || 0,
        firstCoord: g.coordinates?.[0],
      })),
    })
  }, [geofences])

  // Fetch vehicle locations on load
  useEffect(() => {
    const loadLocations = async () => {
      if (vehicles.length === 0) return
      try {
        const ids = vehicles.map(v => v.vehicle_id)
        console.log('[Map] Fetching locations for vehicle IDs:', ids)
        const results = await api.getVehicleLocations(ids)
        console.log('[Map] Got location results:', results)
        
        const locs = {}
        results.forEach(result => {
          if (result) {
            const vehicleId = result.vehicle?.vehicle_id || result.vehicle_id
            locs[vehicleId] = {
              lat: result.current_location?.latitude || result.latitude,
              lng: result.current_location?.longitude || result.longitude,
              active: (result.active_geofences?.length ?? 0) > 0,
              activeGeofences: result.active_geofences ?? [],
            }
          }
        })
        setVehicleLocs(locs)
        console.log('[Map] Loaded locations:', locs)
      } catch (err) {
        console.error('[Map] Failed to load locations:', err)
      }
    }

    loadLocations()
    const interval = setInterval(loadLocations, 8000)
    return () => clearInterval(interval)
  }, [vehicles])

  const handleMapClick = useCallback((latlng) => {
    console.log('[Map] Map clicked at:', latlng, {
      isDrawing,
      selectedVehicle,
      drawnPoints: drawnPoints.length,
    })

    // If in drawing mode, add point to polygon
    if (isDrawing) {
      const newPoint = [latlng.lng, latlng.lat]
      setDrawnPoints(prev => [...prev, newPoint])
      console.log('[Map] Added draw point:', newPoint, 'total:', drawnPoints.length + 1)
      return
    }

    // Otherwise, if vehicle selected, prepare to move it
    if (selectedVehicle) {
      console.log('[Map] Setting click position for vehicle', selectedVehicle)
      setClickPos(latlng)
      console.log('[Map] Click pos set for vehicle', selectedVehicle, latlng)
    } else {
      console.log('[Map] No vehicle selected - cannot move')
    }
  }, [isDrawing, selectedVehicle, drawnPoints])

  const moveVehicle = async () => {
    console.log('[Map] moveVehicle called:', { selectedVehicle, clickPos })
    if (!selectedVehicle || !clickPos) {
      console.log('[Map] moveVehicle: missing selectedVehicle or clickPos')
      return
    }
    
    setUpdating(selectedVehicle)
    try {
      console.log('[Map] Calling updateLocation API...', { vehicleId: selectedVehicle, lat: clickPos.lat, lng: clickPos.lng })
      const result = await api.updateLocation(selectedVehicle, clickPos.lat, clickPos.lng)
      console.log('[Map] Vehicle moved successfully:', result)
      
      setVehicleLocs(prev => ({
        ...prev,
        [selectedVehicle]: {
          lat:             clickPos.lat,
          lng:             clickPos.lng,
          active:          (result.active_geofences?.length ?? 0) > 0,
          activeGeofences: result.active_geofences ?? [],
        },
      }))
      toast.success(`📍 ${vehicles.find(v => v.vehicle_id === selectedVehicle)?.vehicle_number} moved`)
      setClickPos(null)
    } catch (err) {
      console.error('[Map] Failed to update location:', err)
      toast.error('Failed to update location')
    } finally {
      setUpdating(null)
    }
  }

  const handleGeofenceDrawn = useCallback((geoJSON) => {
    console.log('[Map] Geofence drawn, opening name dialog:', geoJSON)
    setDrawDialog(geoJSON)
    setDrawName('')
    setDrawCategory('')
  }, [])

  const saveDrawnGeofence = async () => {
    if (!drawName.trim()) {
      toast.error('Please enter a geofence name')
      return
    }
    if (!drawCategory.trim()) {
      toast.error('Please select a category')
      return
    }
    setSavingGeofence(true)
    try {
      const coordinates = drawDialog.geometry.coordinates[0]
      console.log('[Map] Coordinates to send:', coordinates)
      console.log('[Map] Coordinates count:', coordinates.length)
      console.log('[Map] First point:', coordinates[0])
      console.log('[Map] Last point:', coordinates[coordinates.length - 1])
      
      const payload = {
        geofence_name: drawName,
        category: drawCategory,
        description: '',
        coordinates: coordinates,
      }
      console.log('[Map] Saving geofence with payload:', JSON.stringify(payload, null, 2))
      
      const response = await api.createGeofence(payload)
      console.log('[Map] Geofence save response:', response)
      
      toast.success(`✓ Geofence "${drawName}" created`)
      setDrawDialog(null)
      setDrawName('')
      setDrawCategory('')
    } catch (err) {
      console.error('[Map] Failed to save geofence - Full error:', err)
      console.error('[Map] Error response data:', err.response?.data)
      toast.error(err.response?.data?.error ?? 'Failed to create geofence')
    } finally {
      setSavingGeofence(false)
    }
  }

  return (
    <>
      {/* Draw geofence dialog */}
      {drawDialog && (
        <div className="absolute inset-0 z-[999] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => { setDrawDialog(null) }} />
          <div className="relative bg-gradient-to-br from-white to-gray-50 rounded-3xl shadow-2xl p-7 max-w-md w-full mx-4 border border-white/60 animate-in fade-in slide-in-from-bottom-4">
            <h3 className="text-2xl font-bold text-gray-900 mb-2">✨ Create Geofence</h3>
            <p className="text-sm text-gray-600 mb-6">Draw and name your geofence zone</p>
            
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Geofence Name *</label>
                <input
                  type="text"
                  value={drawName}
                  onChange={(e) => setDrawName(e.target.value)}
                  placeholder="e.g., Downtown Zone, Warehouse..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  autoFocus
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                <select
                  value={drawCategory}
                  onChange={(e) => setDrawCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="">-- Select Category --</option>
                  <option value="Restricted Zone">Restricted Zone</option>
                  <option value="Service Area">Service Area</option>
                  <option value="Warehouse">Warehouse</option>
                  <option value="Delivery Zone">Delivery Zone</option>
                  <option value="Parking Lot">Parking Lot</option>
                  <option value="No-Entry Zone">No-Entry Zone</option>
                  <option value="Speed Zone">Speed Zone</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setDrawDialog(null)}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors"
              >
                Discard
              </button>
              <button
                onClick={saveDrawnGeofence}
                disabled={savingGeofence || !drawName.trim() || !drawCategory.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 transition-colors flex items-center justify-center gap-2"
              >
                {savingGeofence ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    Saving...
                  </>
                ) : (
                  '✓ Create'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="relative h-full w-full">
        {/* Draw mode toolbar - top left */}
        {!isDrawing ? (
          <button
            onClick={() => {
              setIsDrawing(true)
              setDrawnPoints([])
              toast.success('✏️ Draw mode ON - Click map to add points, then finish')
            }}
            className="absolute top-4 right-20 z-[700] px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-semibold hover:shadow-lg transition-all shadow-md hover:scale-105 active:scale-95"
          >
            ✏️ Draw Geofence
          </button>
        ) : (
          <div className="absolute top-4 right-20 z-[700] bg-white rounded-lg shadow-lg border-2 border-blue-500 p-3 animate-pulse">
            <p className="text-sm font-semibold text-gray-900 mb-2">Drawing Geofence</p>
            <p className="text-xs text-gray-600 mb-3">Points: {drawnPoints.length}</p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (drawnPoints.length < 3) {
                    toast.error('⚠️ Need at least 3 points for a polygon')
                    return
                  }
                  const closedPolygon = [...drawnPoints, drawnPoints[0]]
                  setDrawDialog({
                    geometry: {
                      type: 'Polygon',
                      coordinates: [closedPolygon],
                    },
                  })
                  setIsDrawing(false)
                  setDrawnPoints([])
                }}
                className="flex-1 px-3 py-2 bg-green-600 text-white rounded font-medium text-sm hover:bg-green-700"
              >
                ✓ Finish
              </button>
              <button
                onClick={() => {
                  setIsDrawing(false)
                  setDrawnPoints([])
                  toast.info('Draw cancelled')
                }}
                className="flex-1 px-3 py-2 bg-gray-400 text-white rounded font-medium text-sm hover:bg-gray-500"
              >
                ✕ Cancel
              </button>
            </div>
          </div>
        )}

        {/* Vehicle selector panel - top left - IMPROVED STYLING */}
        <div className="absolute top-20 left-4 z-[600] bg-white backdrop-blur-md bg-opacity-95 rounded-2xl shadow-2xl border border-white/60 p-3 max-w-xs transition-all duration-200 hover:shadow-3xl">
          <div className="mb-2">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-widest">📍 Select Vehicle</p>
          </div>
          
          {vehicles.length > 0 ? (
            <div className="space-y-2 max-h-52 overflow-y-auto pr-2">
              {vehicles.map(v => {
                const loc = vehicleLocs[v.vehicle_id]
                const isSelected = selectedVehicle === v.vehicle_id
                return (
                  <button
                    key={v.vehicle_id}
                    onClick={() => setSelectedVehicle(v.vehicle_id)}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-all border-2 text-xs font-medium ${
                      isSelected
                        ? 'border-blue-500 bg-blue-100 text-blue-900 shadow-md transform scale-[1.02]'
                        : 'border-gray-300 bg-gray-50 hover:bg-gray-100 hover:border-gray-400 text-gray-800 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div className="min-w-0">
                        <p className="font-bold text-gray-900">{v.vehicle_number}</p>
                        <p className="text-xs text-gray-600 font-medium">{v.driver_name}</p>
                        {loc && (
                          <p className="text-xs text-gray-500 font-mono mt-0.5">
                            📍 {loc.lat.toFixed(4)}, {loc.lng.toFixed(4)}
                          </p>
                        )}
                        {loc?.activeGeofences.length > 0 && (
                          <span className="inline-block text-xs bg-green-200 text-green-800 px-2 py-1 rounded-lg mt-1 font-semibold">
                            ✓ Inside: {loc.activeGeofences[0]?.geofence_name}
                          </span>
                        )}
                      </div>
                      <div className={`shrink-0 w-2.5 h-2.5 rounded-full mt-1 ${
                        loc?.active ? 'bg-green-500 shadow-lg shadow-green-500/50' : 'bg-gray-300'
                      }`} />
                    </div>
                  </button>
                )
              })}
            </div>
          ) : (
            <p className="text-xs text-gray-400 text-center py-2">No vehicles</p>
          )}

          {selectedVehicle && (
            <div className="mt-3 pt-3 border-t border-gray-300">
              <p className="text-xs text-blue-600 font-bold">✓ {vehicles.find(v => v.vehicle_id === selectedVehicle)?.vehicle_number}</p>
              <p className="text-xs text-gray-500 mt-1">tracking live location</p>
            </div>
          )}
        </div>

        {/* Debug overlay - show if no geofences */}
        {(!geofences || geofences.length === 0) && (
          <div className="absolute bottom-4 left-4 z-[500] bg-yellow-50 border-2 border-yellow-300 rounded-lg p-3 max-w-xs">
            <p className="text-sm font-medium text-yellow-900">📍 No geofences to display</p>
            <p className="text-xs text-yellow-700 mt-1">Geofences panel should show data</p>
            <p className="text-xs text-gray-500 mt-2 font-mono">geofences: {geofences?.length || 0}</p>
          </div>
        )}
        
        {/* Click-to-move overlay */}
        {clickPos && selectedVehicle && (
          <div className="absolute top-4 right-4 z-[999] bg-white rounded-2xl shadow-xl border-2 border-blue-200 p-4 min-w-[280px]">
            <p className="text-sm font-semibold text-gray-900 mb-2">
              Move <span className="text-blue-600">{vehicles.find(v => v.vehicle_id === selectedVehicle)?.vehicle_number}</span> to this location?
            </p>
            <p className="text-sm font-mono text-gray-600 mb-4 p-2 bg-gray-50 rounded border border-gray-200">
              {clickPos.lat.toFixed(5)}, {clickPos.lng.toFixed(5)}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => moveVehicle()}
                disabled={updating === selectedVehicle}
                className="flex-1 text-sm bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white px-4 py-2 rounded-lg
                           transition-colors font-medium disabled:cursor-not-allowed flex items-center justify-center"
              >
                {updating === selectedVehicle ? (
                  <span className="animate-spin mr-2">⏳</span>
                ) : (
                  '✓'
                )}
                {updating === selectedVehicle ? 'Moving...' : 'Move Vehicle'}
              </button>
              <button
                onClick={() => setClickPos(null)}
                className="flex-1 text-sm bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg
                           transition-colors font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        
        {/* Instruction overlay */}
        {selectedVehicle && !clickPos && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[500] 
                          bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-2xl p-4 max-w-xs text-center
                          shadow-2xl border border-blue-400/50 backdrop-blur-sm animate-pulse">
            <p className="text-sm font-bold">👆 Click on the map to move {vehicles.find(v => v.vehicle_id === selectedVehicle)?.vehicle_number}</p>
          </div>
        )}

        <MapContainer
          center={[20.5937, 78.9629]}
          zoom={5}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />
          <ClickHandler onMapClick={handleMapClick} />
          <BoundsManager geofences={geofences} />
          <VehicleZoom selectedVehicle={selectedVehicle} vehicleLocs={vehicleLocs} />

          {/* Geofence polygons */}
          {geofences && geofences.length > 0 ? geofences.map((g, i) => {
            const rawCoords = g.coordinates || []
            let positions = rawCoords.map(c => {
              if (!Array.isArray(c) || c.length < 2) return null
              const [lng, lat] = c
              return [lat, lng]
            }).filter(p => p !== null)
            
            if (positions.length < 3) {
              console.warn(`[Map] Geofence "${g.geofence_name}" has < 3 positions, skipping`)
              return null
            }
            
            const color = GEOFENCE_COLORS[i % GEOFENCE_COLORS.length]
            return (
              <Polygon
                key={g.geofence_id}
                positions={positions}
                pathOptions={{ color, fillOpacity: 0.12, weight: 2.5 }}
                eventHandlers={{
                  click: (e) => {
                    e.originalEvent.stopPropagation()
                    handleMapClick(e.latlng)
                  }
                }}
              >
                <Popup>
                  <div className="text-sm">
                    <p className="font-semibold">{g.geofence_name}</p>
                    {g.category && (
                      <span className="inline-block mt-1 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                        {g.category}
                      </span>
                    )}
                    <p className="text-xs text-gray-400 mt-1">{positions.length} vertices</p>
                  </div>
                </Popup>
              </Polygon>
            )
          }) : null}

          {/* Clicked point marker */}
          {clickPos && (
            <Marker 
              position={clickPos} 
              icon={clickedPinIcon()}
              eventHandlers={{
                click: () => setClickPos(null)
              }}
            />
          )}

          {/* Vehicle markers */}
          {vehicles.map(v => {
            const loc = vehicleLocs[v.vehicle_id]
            if (!loc) return null
            const isSelected = selectedVehicle === v.vehicle_id
            return (
              <Marker
                key={v.vehicle_id}
                position={[loc.lat, loc.lng]}
                icon={vehicleIcon(loc.active, isSelected)}
                eventHandlers={{
                  click: (e) => {
                    e.originalEvent.stopPropagation()
                  }
                }}
              >
                <Popup>
                  <div className="text-sm min-w-[160px]">
                    <p className="font-semibold">{v.vehicle_number}</p>
                    <p className="text-xs text-gray-500">{v.driver_name}</p>
                    <p className="text-xs text-gray-400 mt-1">{v.vehicle_type} · {v.phone}</p>
                    {loc.activeGeofences.length > 0 ? (
                      <div className="mt-2">
                        <p className="text-xs font-medium text-green-700">Currently inside:</p>
                        {loc.activeGeofences.map(g => (
                          <p key={g.geofence_id} className="text-xs text-green-600">• {g.geofence_name}</p>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 mt-2">Outside all geofences</p>
                    )}
                    <p className="text-xs text-gray-300 mt-1 font-mono">
                      {loc.lat.toFixed(5)}, {loc.lng.toFixed(5)}
                    </p>
                  </div>
                </Popup>
              </Marker>
            )
          })}

          {/* Drawn points on map - inside MapContainer */}
          {isDrawing && drawnPoints.map((point, i) => (
            <Marker key={`draw-${i}`} position={[point[1], point[0]]} icon={L.divIcon({
              html: `<div style="width:20px;height:20px;background:blue;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-size:12px;font-weight:bold">${i+1}</div>`,
              iconSize: [20, 20],
              iconAnchor: [10, 10],
            })} />
          ))}
          {isDrawing && drawnPoints.length > 1 && (
            <Polygon positions={drawnPoints.map(p => [p[1], p[0]])} pathOptions={{ color: '#3b82f6', fillOpacity: 0.2, weight: 2 }} />
          )}
        </MapContainer>
      </div>
    </>
  )
}
