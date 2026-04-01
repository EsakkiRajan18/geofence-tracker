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

---

## 🚀 PRODUCTION DEPLOYMENT GUIDE

### Overview
```
┌──────────────────────────────────────────────────────────────┐
│                    PRODUCTION ARCHITECTURE                    │
├──────────────────────────────────────────────────────────────┤
│  Frontend (Vercel/Netlify)    Backend (Render/Railway/EC2)   │
│       ↓                              ↓                        │
│  React SPA (dist/)     ←→  REST API + WebSocket (8080)       │
│  HTTPS (CDN)           ←→  Docker Container                  │
│       ↓                              ↓                        │
│   Browser                    PostgreSQL + PostGIS            │
│                         (RDS/Managed/Docker)                 │
└──────────────────────────────────────────────────────────────┘
```

---

### Step 1: Push to Docker Hub

#### Prerequisites
- Docker Hub account: https://hub.docker.com/
- Docker CLI installed and logged in: `docker login`

#### Build and Push Backend Image

```bash
# Navigate to project root
cd geofence-tracker

# Build the backend image
docker build -t YOUR-USERNAME/geofence-tracker-backend:latest ./backend

# Tag with version (optional but recommended)
docker tag YOUR-USERNAME/geofence-tracker-backend:latest \
           YOUR-USERNAME/geofence-tracker-backend:v1.0.0

# Push to Docker Hub
docker push YOUR-USERNAME/geofence-tracker-backend:latest
docker push YOUR-USERNAME/geofence-tracker-backend:v1.0.0

# Verify on Docker Hub dashboard
# https://hub.docker.com/r/YOUR-USERNAME/geofence-tracker-backend
```

**Example (replace YOUR-USERNAME):**
```bash
docker build -t esakkimaran/geofence-tracker-backend:latest ./backend
docker push esakkimaran/geofence-tracker-backend:latest
```

---

### Step 2: Deploy Backend

**Option A: Render.com** (Easiest)
```bash
# 1. Sign up at https://render.com

# 2. Create new Web Service
#    - GitHub/GitLab repo
#    - Runtime: Docker
#    - Build Command: docker build -t myapp . ./backend
#    - Start Command: ./server
#    - Environment:
DATABASE_URL=postgresql://user:pass@db-host:5432/geofence?sslmode=require
SEED_API_KEY=your-secure-api-key-here
PORT=10000

# 3. Add PostgreSQL Database (via Render)
#    - Region: same as backend
#    - Backup: enabled
#    - Create and save DATABASE_URL

# 4. Link backend to database in Render Environment
```

**Option B: Railway.app** (Quick Setup)
```bash
# 1. https://railway.app signup
# 2. New Project → Docker
# 3. Upload Dockerfile from ./backend
# 4. Add PostgreSQL (Railway plugin)
# 5. Set environment variables (same as above)
# 6. Deploy (auto-generates public URL)
```

**Option C: AWS EC2** (Full Control)
```bash
# 1. Launch EC2 instance (Ubuntu 22.04 LTS)
# 2. SSH into instance
# 3. Install Docker & Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 4. Clone repo
git clone https://github.com/YOUR-USERNAME/geofence-tracker.git
cd geofence-tracker

# 5. Create .env file
cat > .env <<EOF
DATABASE_URL=postgresql://user:pass@rds-endpoint:5432/geofence?sslmode=require
SEED_API_KEY=your-secure-key
PORT=8080
EOF

# 6. Run with docker-compose
docker-compose -f docker-compose.yml up -d

# 7. Configure Security Group (inbound):
#    - Port 80 (HTTP)
#    - Port 443 (HTTPS)
#    - Port 8080 (Backend, optional)
```

**Option D: DigitalOcean** (Via Docker Hub)
```bash
# 1. Create App Platform or Droplet
# 2. Deploy from Docker Hub image:
#    docker pull YOUR-USERNAME/geofence-tracker-backend
# 3. Or use docker-compose:
#    docker-compose up -d
```

---

### Step 3: Database Setup

#### Using Managed PostgreSQL (Recommended for Production)

**Render PostgreSQL:**
```bash
# Automatically created; copy DATABASE_URL
# Format: postgresql://user:randompass@dpg-xyz.render.internal:5432/geofence
```

**Railway PostgreSQL:**
```bash
# Click "Add" → PostgreSQL
# Auto-generates connection string in env vars
```

**AWS RDS:**
```bash
# 1. https://aws.amazon.com/rds/
# 2. Create DB Instance (PostgreSQL 15)
# 3. Add PostGIS extension:
#    psql -U postgres -h rds-endpoint -d geofence
#    postgres=# CREATE EXTENSION postgis;
#    postgres=# \dx
```

**DigitalOcean Managed Database:**
```bash
# 1. Create Managed PostgreSQL
# 2. Auto-creates primary + replicas
# 3. Copy connection string to backend env vars
```

#### Seed Database
```bash
# If using managed DB, manually create tables:
psql -U postgres -h your-db-host -d geofence < migrations/init.sql

# Tables created:
# - geofences
# - vehicles
# - alerts
# - violation_history
# - vehicle_geofence_state
# - api_keys
```

---

### Step 4: Deploy Frontend

#### Environment Variables for Frontend

Create `.env` or set in your hosting platform:

```env
# .env (development & build-time)
VITE_API_URL=https://your-backend.example.com
VITE_WS_URL=wss://your-backend.example.com
VITE_API_KEY=your-production-api-key
```

#### Deploy to Vercel

```bash
# 1. Sign up: https://vercel.com

# 2. Install Vercel CLI
npm install -g vercel

# 3. From frontend directory
cd frontend
vercel

# 4. Set environment variables in Vercel dashboard:
#    Project Settings → Environment Variables
#    VITE_API_URL = https://backend-xyz.onrender.com
#    VITE_WS_URL = wss://backend-xyz.onrender.com
#    VITE_API_KEY = your-api-key

# 5. Redeploy
vercel --prod
```

#### Deploy to Netlify

```bash
# 1. Sign up: https://netlify.com

# 2. Build locally
cd frontend
npm run build

# 3. Drag-and-drop dist/ folder or connect GitHub

# 4. Setup environment variables:
#    Site settings → Build & Deploy → Environment
#    Add same VITE_* variables

# 5. Trigger redeploy
```

#### Deploy to Cloudflare Pages

```bash
# 1. Sign up: https://pages.cloudflare.com

# 2. Connect GitHub repo

# 3. Build settings:
#    Framework: None
#    Build command: npm run build
#    Build output directory: dist

# 4. Set environment variables (same as above)

# 5. Publish
```

---

### Step 5: Configure API Key

**Production API Key Setup:**

```bash
# Never use 'dev-secret-key-change-me' in production!

# 1. Generate secure key (32 bytes):
openssl rand -hex 16
# Output: a7f3d9e4c2b1f8a6e5d4c3b2a1f9e8d7

# 2. Set in backend environment:
SEED_API_KEY=a7f3d9e4c2b1f8a6e5d4c3b2a1f9e8d7

# 3. Set in frontend environment:
VITE_API_KEY=a7f3d9e4c2b1f8a6e5d4c3b2a1f9e8d7

# 4. Restart backend service
docker-compose restart backend
```

---

### Step 6: Test Deployed Services

#### Test Backend API

```bash
# Replace with your backend URL
BACKEND_URL="https://your-backend.example.com"
API_KEY="your-api-key"

# 1. Health check
curl -s "$BACKEND_URL/health" | jq

# 2. Create geofence
curl -s -X POST "$BACKEND_URL/geofences" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "geofence_name": "Test Zone",
    "category": "test",
    "coordinates": [[77.5, 12.9], [77.6, 12.9], [77.6, 13.0], [77.5, 13.0], [77.5, 12.9]]
  }' | jq

# 3. Test WebSocket
websocat "wss://your-backend.example.com/ws/alerts"
# Should connect successfully
```

#### Test Frontend

```bash
# 1. Open in browser:
https://your-frontend.example.com

# 2. Verify no console errors
# 3. Test creating a geofence
# 4. Test vehicle registration
# 5. Check WebSocket connection (DevTools → Network → WS)
```

---

### Step 7: Enable HTTPS & SSL

#### For Backend (Render/Railway Auto-SSL)
```bash
# Render & Railway auto-enable HTTPS
# Verify with:
curl -I https://your-backend.example.com
# Should return 200 OK
```

#### For Custom Domain (Render)
```bash
# 1. Add custom domain in Render dashboard
# 2. Update DNS with CNAME pointing to Render
# 3. Auto-provisions Let's Encrypt cert
```

#### For Nginx (EC2/VPS)
```bash
# 1. Install Certbot
sudo apt install certbot python3-certbot-nginx

# 2. Issue cert
sudo certbot certonly --standalone -d your-backend.example.com

# 3. Update nginx.conf
cat > /etc/nginx/conf.d/default.conf <<EOF
server {
    listen 443 ssl;
    server_name your-backend.example.com;

    ssl_certificate /etc/letsencrypt/live/your-backend.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-backend.example.com/privkey.pem;

    location / {
        proxy_pass http://backend:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
EOF

# 4. Reload
sudo nginx -s reload
```

---

### Step 8: Production Monitoring & Logs

#### View Backend Logs

**Render:**
```bash
# Via dashboard: Logs tab
# Or use Render CLI
render logs backend-service-id
```

**Railway:**
```bash
# Via dashboard: Logs tab
# Real-time monitoring
```

**AWS EC2:**
```bash
# SSH into instance
ssh -i your-key.pem ubuntu@your-instance-ip

# View docker logs
docker logs -f geofence_backend

# Check disk/memory
df -h
free -m
```

#### Error Handling

```bash
# Common issues:
# 1. Backend not connecting to DB
#    → Check DATABASE_URL in env vars
#    → Verify DB is accessible (test connection)

# 2. Frontend can't reach backend
#    → Check VITE_API_URL in frontend env
#    → Verify backend is running
#    → Test CORS headers

# 3. WebSocket connection fails
#    → Ensure wss:// (secure) is used for HTTPS backend
#    → Check firewall allows WebSocket traffic

# 4. HTTPS cert issues
#    → Verify DNS points to backend
#    → Wait 10 mins for DNS propagation
#    → Check cert with: openssl s_client -connect your-backend.example.com:443
```

---

### Step 9: Deployment Checklist

Before going live, verify:

- [ ] Backend Docker image built and pushed to Docker Hub
- [ ] Backend deployed and accessible at `https://your-backend.example.com`
- [ ] Database migrated with all tables created
- [ ] Database connection string verified in backend env vars
- [ ] API key generated and set in both backend & frontend env vars
- [ ] Frontend build succeeds: `npm run build`
- [ ] Frontend deployed at `https://your-frontend.example.com`
- [ ] Frontend env vars include correct backend URL
- [ ] API endpoints return correct responses with `time_ns` field
- [ ] WebSocket `/ws/alerts` connects and broadcasts events
- [ ] HTTPS/SSL enabled for both frontend and backend
- [ ] Rate limiting working (test 11 requests in 1 sec from same IP)
- [ ] CORS headers allow frontend domain
- [ ] Database backups enabled
- [ ] GitHub repo includes all code + docker-compose.yml + SETUP.md
- [ ] Collaborators added to GitHub repo (private)
- [ ] No plaintext secrets in code or repo
- [ ] Health check endpoint responds: `GET /health`

---

### Step 10: GitHub Setup

```bash
# 1. Create GitHub repo (Private!)
# https://github.com/new

# 2. Add all files
git add .
git commit -m "Initial commit: geofence-tracker with Docker + deployment"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/geofence-tracker.git
git push -u origin main

# 3. Add collaborators (if required)
# Settings → Collaborators → Add by email/username
# Choose "Maintainer" role

# 4. Add .gitignore (ensure no secrets)
cat > .gitignore <<EOF
node_modules/
dist/
.env
.env.local
.env.*.local
*.log
.DS_Store
/backend/server
/backend/*.exe
EOF
git add .gitignore
git commit -m "Add gitignore"
git push
```

---

## Frontend Usage Guide

1. **Geofences tab** — Click "New" to create a geofence. Paste a JSON array of `[lng, lat]` pairs (closed polygon). Use the "Bengaluru sample" helper to try it immediately. Geofences appear as coloured polygons on the map.

2. **Vehicles tab** — Click "Register" to add a vehicle. Use the "Manual location update" bar to move a vehicle by typing coordinates. Or click anywhere on the map and select which vehicle to move there.

3. **Alerts tab** — Create rules linking a geofence to an event type (entry/exit/both) and optionally a specific vehicle. Rules fire WebSocket events when matched.

4. **History tab** — Browse paginated entry/exit events. Filter by vehicle, geofence, or date range.

5. **Live alerts** — When a configured rule fires, a toast notification appears (top-right) and the alert is added to the sidebar feed.
