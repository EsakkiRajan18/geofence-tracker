import axios from 'axios'

const BASE = import.meta.env.VITE_API_URL || '/api'
const API_KEY = import.meta.env.VITE_API_KEY || 'dev-secret-key-change-me'

const client = axios.create({
  baseURL: BASE,
  headers: { 'X-API-Key': API_KEY },
})

// Unwrap the nested data field
const unwrap = (res) => res.data.data

export const api = {
  // Geofences
  createGeofence: (body) => client.post('/geofences', body).then(unwrap),
  listGeofences: (category) =>
    client.get('/geofences', { params: category ? { category } : {} }).then(unwrap),
  deleteGeofence: (id) => client.delete(`/geofences/${id}`).then(unwrap),

  // Vehicles
  createVehicle: (body) => client.post('/vehicles', body).then(unwrap),
  listVehicles: () => client.get('/vehicles').then(unwrap),
  deleteVehicle: (id) => client.delete(`/vehicles/${id}`).then(unwrap),
  getVehicleLocation: (id) => client.get(`/vehicles/location/${id}`).then(unwrap),
  // Get multiple vehicle locations by making individual requests
  getVehicleLocations: async (ids) => {
    const requests = ids.map(id => client.get(`/vehicles/location/${id}`).then(unwrap))
    const results = await Promise.all(requests)
    return results
  },
  updateLocation: (vehicleId, latitude, longitude) => 
    client.post('/vehicles/location', { vehicle_id: vehicleId, latitude, longitude }).then(unwrap),

  // Alerts
  configureAlert: (body) => client.post('/alerts/configure', body).then(unwrap),
  listAlerts: (params) => client.get('/alerts', { params }).then(unwrap),
  deleteAlert: (id) => client.delete(`/alerts/${id}`).then(unwrap),

  // Violations
  listViolations: (params) => client.get('/violations/history', { params }).then(unwrap),
}

// Construct WebSocket URL
export const WS_URL = (() => {
  const envUrl = import.meta.env.VITE_WS_URL
  if (envUrl) {
    return envUrl
  }
  
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}/ws/alerts`
})()
