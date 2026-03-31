# GeoFence Tracker — Setup Guide

## Architecture Overview

```
┌─────────────────┐     REST/WS      ┌──────────────────────┐
│  React Frontend │ ←──────────────→ │   Go Backend (8080)  │
│  (Vite + Leaflet│                  │   Gorilla Mux + WS   │
│   + Tailwind)   │                  └──────────┬───────────┘
└─────────────────┘                             │ SQL
                                     ┌──────────▼───────────┐
                                     │ PostgreSQL + PostGIS  │
                                     └──────────────────────┘
```

**Key design decisions:**
- PostGIS `ST_Contains` for accurate point-in-polygon detection
- WebSocket hub with goroutine-per-client write pump and shared broadcast channel
- Entry/exit detection via per-vehicle geofence state table (diff current vs previous)
- API key auth via SHA-256 hash stored in DB (no plaintext)
- Token-bucket rate limiter (10 req/s, burst 30) per IP
- Every API response includes `time_ns` measured with `time.Now()` around handler logic

---

## Prerequisites

| Tool | Version |
|------|---------|
| Docker | 24+ |
| Docker Compose | v2+ |
| Node.js | 18+ (frontend only) |
| Go | 1.21+ (backend local dev only) |

---

## Quick Start — Docker Compose

```bash
# 1. Clone
git clone <your-repo-url>
cd geofence-tracker

# 2. Start everything (PostGIS + backend)
docker-compose up --build

# Backend is now at http://localhost:8080
# Default API key: dev-secret-key-change-me
```

---

## Frontend — Local Dev

```bash
cd frontend
cp .env.example .env        # edit VITE_API_URL / VITE_WS_URL / VITE_API_KEY
npm install
npm run dev                 # → http://localhost:5173
```

**Deploy to Vercel/Netlify:**
```bash
npm run build               # outputs to dist/
# Set env vars in your hosting platform:
#   VITE_API_URL=https://your-backend.example.com
#   VITE_WS_URL=wss://your-backend.example.com
#   VITE_API_KEY=your-production-key
```

---

## Backend — Local Dev (without Docker)

```bash
# Requires a running PostGIS instance
cd backend
go mod tidy
DATABASE_URL="postgres://postgres:postgres@localhost:5432/geofence?sslmode=disable" \
SEED_API_KEY="dev-secret-key-change-me" \
go run ./cmd/server
```

---

## Running Unit Tests

```bash
cd backend
go mod tidy
go test ./...              # runs all packages
go test ./... -v           # verbose output
go test ./internal/api/... -run TestValidate   # specific test
```

Test coverage includes:
- `internal/api` — Geofence/location/alert validation logic
- `internal/db`  — WKT generation and GeoJSON parsing helpers
- `internal/websocket` — Hub broadcast, client connect/disconnect, concurrency
- `internal/middleware` — Rate limiter (burst, refill, IP isolation), API key hashing

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgres://postgres:postgres@localhost:5432/geofence?sslmode=disable` | PostgreSQL connection string |
| `PORT` | `8080` | HTTP server port |
| `SEED_API_KEY` | `dev-secret-key-change-me` | API key seeded into DB on startup |

---

## API Reference & curl Examples

All protected routes require header: `X-API-Key: <your-key>`

### Create a Geofence
```bash
curl -s -X POST http://localhost:8080/geofences \
  -H "X-API-Key: dev-secret-key-change-me" \
  -H "Content-Type: application/json" \
  -d '{
    "geofence_name": "Warehouse Zone A",
    "category": "warehouse",
    "description": "Main storage facility",
    "coordinates": [
      [77.5946, 12.9716],
      [77.6246, 12.9716],
      [77.6246, 12.9916],
      [77.5946, 12.9916],
      [77.5946, 12.9716]
    ]
  }' | jq
```

### List Geofences (with optional category filter)
```bash
curl -s "http://localhost:8080/geofences?category=warehouse" \
  -H "X-API-Key: dev-secret-key-change-me" | jq
```

### Register a Vehicle
```bash
curl -s -X POST http://localhost:8080/vehicles \
  -H "X-API-Key: dev-secret-key-change-me" \
  -H "Content-Type: application/json" \
  -d '{
    "vehicle_number": "KA01AB1234",
    "driver_name": "Ravi Kumar",
    "vehicle_type": "Truck",
    "phone": "9876543210"
  }' | jq
```

### Update Vehicle Location (triggers geofence detection)
```bash
curl -s -X POST http://localhost:8080/vehicles/location \
  -H "X-API-Key: dev-secret-key-change-me" \
  -H "Content-Type: application/json" \
  -d '{
    "vehicle_id": 1,
    "latitude": 12.98,
    "longitude": 77.60
  }' | jq
```

### Get Current Vehicle Location & Active Geofences
```bash
curl -s http://localhost:8080/vehicles/location/1 \
  -H "X-API-Key: dev-secret-key-change-me" | jq
```

### Configure an Alert Rule
```bash
curl -s -X POST http://localhost:8080/alerts/configure \
  -H "X-API-Key: dev-secret-key-change-me" \
  -H "Content-Type: application/json" \
  -d '{
    "geofence_id": 1,
    "event_type": "both"
  }' | jq
# Omit vehicle_id to trigger for ALL vehicles entering/exiting this geofence
```

### List Alerts
```bash
curl -s "http://localhost:8080/alerts?geofence_id=1" \
  -H "X-API-Key: dev-secret-key-change-me" | jq
```

### Violation History (paginated, filterable)
```bash
curl -s "http://localhost:8080/violations/history?vehicle_id=1&page=1&page_size=20" \
  -H "X-API-Key: dev-secret-key-change-me" | jq

# Date range filter (RFC3339)
curl -s "http://localhost:8080/violations/history?from=2024-01-01T00:00:00Z&to=2024-12-31T23:59:59Z" \
  -H "X-API-Key: dev-secret-key-change-me" | jq
```

### WebSocket — Connect to Live Alerts
```bash
# Using websocat (https://github.com/vi/websocat)
websocat "ws://localhost:8080/ws/alerts"
# No auth required on WS endpoint; alerts broadcast when vehicles move
```

---

## Docker Hub Deployment

```bash
# Build and push
cd backend
docker build -t EsakkiRajan18/geofence-tracker-backend:latest .
docker push EsakkiRajan18/geofence-tracker-backend:latest

# On production server
docker-compose -f docker-compose.yml up -d
```

---

## Frontend Usage Guide

1. **Geofences tab** — Click "New" to create a geofence. Paste a JSON array of `[lng, lat]` pairs (closed polygon). Use the "Bengaluru sample" helper to try it immediately. Geofences appear as coloured polygons on the map.

2. **Vehicles tab** — Click "Register" to add a vehicle. Use the "Manual location update" bar to move a vehicle by typing coordinates. Or click anywhere on the map and select which vehicle to move there.

3. **Alerts tab** — Create rules linking a geofence to an event type (entry/exit/both) and optionally a specific vehicle. Rules fire WebSocket events when matched.

4. **History tab** — Browse paginated entry/exit events. Filter by vehicle, geofence, or date range.

5. **Live alerts** — When a configured rule fires, a toast notification appears (top-right) and the alert is added to the sidebar feed.
