import { useEffect, useState, useCallback, useRef } from 'react'
import {
  MapContainer, TileLayer, Polygon, Marker, Popup, useMapEvents, useMap,
} from 'react-leaflet'
import L from 'leaflet'
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
    html: `<div style="font-size:28px;line-height:1;filter:drop-shadow(0 2px 4px rgba(0,0,0,.4))">📍</div>`,
    className: '',
    iconSize: [28, 36],
    iconAnchor: [14, 36],
  })
}

// Captures map clicks including on geofences/polygons
function ClickHandler({ onMapClick }) {
  useMapEvents({ 
    click: (e) => {
      console.log('[Map] Click detected:', { lat: e.latlng.lat, lng: e.latlng.lng })
      onMapClick(e.latlng) 
    } 
  })
  return null
}

// Fits map to geofence bounds when geofences load
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

export default function MainMap({ geofences, vehicles }) {
  const [vehicleLocs, setVehicleLocs] = useState({})
  const [selectedVehicle, setSelectedVehicle] = useState(null)
  const [clickPos, setClickPos]       = useState(null)
  const [updating, setUpdating]       = useState(null)

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

  // Poll each vehicle's latest location every 8 s
  useEffect(() => {
    if (vehicles.length === 0) return
    const poll = async () => {
      await Promise.allSettled(
        vehicles.map(async (v) => {
          try {
            const data = await api.getVehicleLocation(v.vehicle_id)
            if (data?.current_location) {
              setVehicleLocs(prev => ({
                ...prev,
                [v.vehicle_id]: {
                  lat:             data.current_location.latitude,
                  lng:             data.current_location.longitude,
                  active:          (data.active_geofences?.length ?? 0) > 0,
                  activeGeofences: data.active_geofences ?? [],
                },
              }))
            }
          } catch {}
        })
      )
    }
    poll()
    const t = setInterval(poll, 8000)
    return () => clearInterval(t)
  }, [vehicles])

  const handleMapClick = useCallback((latlng) => {
    if (!selectedVehicle) {
      toast.error('Please select a vehicle first')
      return
    }
    console.log('[Map] Position selected for vehicle movement:', { vehicle: selectedVehicle, latlng })
    setClickPos(latlng)
  }, [selectedVehicle])

  const moveVehicle = async () => {
    if (!clickPos || !selectedVehicle) return
    console.log('[Map] Moving vehicle to:', { vehicleId: selectedVehicle, position: clickPos })
    setUpdating(selectedVehicle)
    try {
      const result = await api.updateLocation({
        vehicle_id: selectedVehicle,
        latitude:   clickPos.lat,
        longitude:  clickPos.lng,
      })
      console.log('[Map] Vehicle moved successfully:', { vehicleId: selectedVehicle, activeGeofences: result.active_geofences })
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

  return (
    <div className="relative h-full w-full">
      {/* Vehicle selector panel - top left */}
      <div className="absolute top-4 left-4 z-[600] bg-white rounded-2xl shadow-lg border border-gray-200 p-4 max-w-sm">
        <div className="mb-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Select Vehicle</p>
          <p className="text-xs text-gray-400 mt-1">Choose a vehicle, then click on map to move</p>
        </div>
        
        {vehicles.length > 0 ? (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {vehicles.map(v => {
              const loc = vehicleLocs[v.vehicle_id]
              const isSelected = selectedVehicle === v.vehicle_id
              return (
                <button
                  key={v.vehicle_id}
                  onClick={() => setSelectedVehicle(v.vehicle_id)}
                  className={`w-full text-left p-3 rounded-xl transition-all border-2 ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{v.vehicle_number}</p>
                      <p className="text-xs text-gray-600">{v.driver_name}</p>
                      {loc && (
                        <p className="text-xs text-gray-400 mt-1 font-mono">
                          {loc.lat.toFixed(4)}, {loc.lng.toFixed(4)}
                        </p>
                      )}
                      {loc?.activeGeofences.length > 0 && (
                        <div className="mt-1">
                          <span className="inline-block text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                            Inside: {loc.activeGeofences[0]?.geofence_name}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className={`shrink-0 w-2 h-2 rounded-full mt-2 ${
                      loc?.active ? 'bg-green-500' : 'bg-gray-300'
                    }`} />
                  </div>
                </button>
              )
            })}
          </div>
        ) : (
          <p className="text-xs text-gray-400 text-center py-4">No vehicles registered</p>
        )}

        {selectedVehicle && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <p className="text-xs text-blue-600 font-medium">✓ {vehicles.find(v => v.vehicle_id === selectedVehicle)?.vehicle_number} selected</p>
            <p className="text-xs text-gray-500 mt-1">Click on the map to move this vehicle</p>
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
      
      {/* Click-to-move overlay - simplified for single vehicle */}
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
      
      {/* Instruction overlay - show if vehicle selected and no click yet */}
      {selectedVehicle && !clickPos && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[500] 
                        bg-blue-50 border-2 border-blue-300 rounded-lg p-3 max-w-xs text-center">
          <p className="text-sm font-medium text-blue-900">👆 Click on the map to move vehicle</p>
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

        {/* Geofence polygons */}
        {geofences && geofences.length > 0 ? geofences.map((g, i) => {
          const rawCoords = g.coordinates || []
          
          // API returns coordinates in [lng, lat] format
          // Leaflet expects [lat, lng] format, so always convert
          let positions = rawCoords.map(c => {
            if (!Array.isArray(c) || c.length < 2) return null
            const [lng, lat] = c
            return [lat, lng]  // Convert to [lat, lng] for Leaflet
          }).filter(p => p !== null)
          
          if (positions.length < 3) {
            console.warn(`[Map] Geofence "${g.geofence_name}" has < 3 positions, skipping`, {
              rawCoords: rawCoords.slice(0, 2),
              parsedPositions: positions.slice(0, 2),
            })
            return null
          }
          
          const color = GEOFENCE_COLORS[i % GEOFENCE_COLORS.length]
          
          console.log(`[Map] Rendering geofence "${g.geofence_name}" (ID: ${g.geofence_id}):`, {
            originalCoords: rawCoords[0],
            leafletPositions: positions[0],
            polyCount: positions.length,
            color,
          })
          
          return (
            <Polygon
              key={g.geofence_id}
              positions={positions}
              pathOptions={{ color, fillOpacity: 0.12, weight: 2.5 }}
              eventHandlers={{
                click: (e) => {
                  // Propagate click to map
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
        }) : (
          <div key="no-geofences" style={{ display: 'none' }}>
            {console.log('[Map] No geofences to render')}
          </div>
        )}

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
      </MapContainer>
    </div>
  )
}
