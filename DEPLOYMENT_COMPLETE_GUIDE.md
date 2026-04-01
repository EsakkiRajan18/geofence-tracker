# Geofence Tracker — Complete Deployment Guide

> **🎯 Goal:** Deploy a fully functional real-time geofence tracking system with a live dashboard in production.

**📊 Time Estimate:** 1.5 hours | **💰 Cost:** Free (free tiers available)

---

## 📋 Table of Contents

1. [Overview & Quick Start](#overview--quick-start)
2. [Prerequisites](#prerequisites)
3. [5-Step Deployment Workflow](#5-step-deployment-workflow)
4. [Docker Hub Setup](#docker-hub-setup)
5. [Backend Deployment Options](#backend-deployment-options)
6. [Frontend Deployment Options](#frontend-deployment-options)
7. [Environment Variables Reference](#environment-variables-reference)
8. [Complete Deployment Checklist](#complete-deployment-checklist)
9. [Troubleshooting Guide](#troubleshooting-guide)
10. [API Response Verification](#api-response-verification)

---

## Overview & Quick Start

### Recommended Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Vercel)                        │
│             https://your-project.vercel.app                 │
└────────────────────────────┬────────────────────────────────┘
                             │ VITE_API_URL + VITE_WS_URL
                             │
┌────────────────────────────▼────────────────────────────────┐
│               Backend (Render/Railway/EC2)                  │
│        https://geofence-backend-xyz.onrender.com            │
└────────────────────────────┬────────────────────────────────┘
                             │ DATABASE_URL
                             │
┌────────────────────────────▼────────────────────────────────┐
│              PostgreSQL (Render/Railway/RDS)                │
│         Auto-provided or managed by platform                │
└─────────────────────────────────────────────────────────────┘
```

### Platform Recommendations

| Component | Platform | Why |
|-----------|----------|-----|
| Backend | **Render.com** | Free tier, auto-PostgreSQL, easiest |
| Frontend | **Vercel** | Free tier, global CDN, fastest builds |
| Database | **Render PostgreSQL** | Auto-managed by Render |
| Docker Registry | **Docker Hub** | Bridge between local and cloud |

---

## Prerequisites

Before starting deployment, ensure you have:

- ✅ Docker installed locally (`docker --version`)
- ✅ Docker Compose working (`docker-compose --version`)
- ✅ GitHub account (create private repo)
- ✅ Docker Hub account (free tier sufficient)
- ✅ Render.com account (free tier sufficient)
- ✅ Vercel account (free tier sufficient)
- ✅ All local tests passing (`docker-compose up` works)

---

## 5-Step Deployment Workflow

### Step 1: Push Docker Image to Docker Hub (5 min)

This is the bridge between your local development and cloud deployment.

```bash
cd /path/to/geofence-tracker

# 1. Build backend image
docker build -t YOUR-USERNAME/geofence-tracker-backend:latest ./backend

# 2. Tag version (optional but recommended)
docker tag YOUR-USERNAME/geofence-tracker-backend:latest \
           YOUR-USERNAME/geofence-tracker-backend:v1.0.0

# 3. Verify you're logged in
docker login

# 4. Push to Docker Hub
docker push YOUR-USERNAME/geofence-tracker-backend:latest
docker push YOUR-USERNAME/geofence-tracker-backend:v1.0.0

# 5. Verify on Docker Hub
#    https://hub.docker.com/r/YOUR-USERNAME/geofence-tracker-backend
```

### Step 2: Deploy Backend on Render.com (10 min)

```bash
# 1. Sign up: https://render.com
# 2. Create new Web Service
#    - Environment: Docker
#    - Docker image: YOUR-USERNAME/geofence-tracker-backend:latest
#    - Plan: Starter (free)
#    - Region: Choose closest to you

# 3. Add PostgreSQL Database
#    - New PostgreSQL instance
#    - Starter plan (free)
#    - Same region as backend

# 4. Set environment variables on backend service:
DATABASE_URL=[auto-provided by Render PostgreSQL]
SEED_API_KEY=your-secure-random-key-here
PORT=8000

# 5. Deploy (Render auto-deploys)
# 6. Get backend URL: https://geofence-backend-xyz.onrender.com
```

### Step 3: Push Code to GitHub (5 min)

```bash
cd /path/to/geofence-tracker

# 1. Create private GitHub repo
#    https://github.com/new

# 2. Initialize (if not already done)
git init
git add .
git commit -m "Initial: Full-stack geofence tracker"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/geofence-tracker.git
git push -u origin main

# 3. Add collaborators (GitHub → Settings → Collaborators)
#    Add reviewer emails with "Maintainer" role
```

### Step 4: Deploy Frontend on Vercel (5 min)

```bash
# 1. Sign up: https://vercel.com
# 2. Add Project → Import Git Repository
#    - Select your GitHub repo
#    - Root Directory: frontend
#    - Build command: npm run build
#    - Output: dist

# 3. Set environment variables:
VITE_API_URL=https://geofence-backend-xyz.onrender.com
VITE_WS_URL=wss://geofence-backend-xyz.onrender.com
VITE_API_KEY=your-secure-random-key-here

# 4. Deploy (Vercel auto-deploys on git push)
# 5. Get frontend URL: https://your-project.vercel.app
```

### Step 5: Test Live Endpoints (5 min)

```bash
# Test backend API
curl -H "X-API-Key: your-secure-random-key-here" \
  https://geofence-backend-xyz.onrender.com/geofences | jq

# Test frontend loads
open https://your-project.vercel.app

# Test WebSocket in browser DevTools
# Open DevTools → Network → WS
# Alerts should connect via /ws/alerts
```

---

## Docker Hub Setup

### Complete Step-by-Step

#### 1. Create Docker Hub Account

```bash
# Go to: https://hub.docker.com
# Sign up with email/GitHub
# Verify email
```

#### 2. Create Repository

```bash
# Docker Hub Dashboard → Create Repository
# Name: geofence-tracker-backend
# Description: "Geofence tracker - Real-time alerts with Go, PostgreSQL, WebSocket"
# Visibility: PUBLIC (required for deployment)
# Create
```

#### 3. Login Locally

```bash
docker login

# Enter credentials:
# Username: YOUR-USERNAME
# Password: YOUR-PASSWORD or Personal Access Token
# ✅ Login complete

# Verify:
docker ps  # Should work without errors
```

#### 4. Build Image

```bash
cd /path/to/geofence-tracker

# Build with correct tag format: username/repo-name:tag
docker build -t YOUR-USERNAME/geofence-tracker-backend:latest ./backend

# Verify build
docker images | grep geofence-tracker-backend
```

#### 5. Push to Docker Hub

```bash
# Push latest tag
docker push YOUR-USERNAME/geofence-tracker-backend:latest

# Optional: Push version tag
docker tag YOUR-USERNAME/geofence-tracker-backend:latest \
           YOUR-USERNAME/geofence-tracker-backend:v1.0.0
docker push YOUR-USERNAME/geofence-tracker-backend:v1.0.0

# Output should show:
# Pushing YOUR-USERNAME/geofence-tracker-backend
# latest: digest: sha256:abc123...
# ✅ Pushed successfully
```

#### 6. Verify on Docker Hub

```bash
# Visit: https://hub.docker.com/r/YOUR-USERNAME/geofence-tracker-backend
# You should see:
# - Image tags (latest, v1.0.0)
# - Pull command: docker pull YOUR-USERNAME/geofence-tracker-backend:latest
# - Last pushed timestamp
```

### Common Docker Hub Commands

```bash
# Build with specific tag
docker build -t YOUR-USERNAME/geofence-tracker-backend:v2.0.0 ./backend

# Tag existing image
docker tag YOUR-USERNAME/geofence-tracker-backend:latest \
           YOUR-USERNAME/geofence-tracker-backend:v1.0.0

# Push multiple tags
docker push YOUR-USERNAME/geofence-tracker-backend:latest
docker push YOUR-USERNAME/geofence-tracker-backend:v1.0.0

# List local images
docker images YOUR-USERNAME/geofence-tracker-backend

# Pull image (for testing)
docker pull YOUR-USERNAME/geofence-tracker-backend:latest

# Check image size
docker images --format "{{.Repository}}:{{.Tag}} {{.Size}}" | grep geofence
```

---

## Backend Deployment Options

### Option 1: Render.com (🏆 RECOMMENDED)

**Why:** Free tier, auto-PostgreSQL, simplest setup, auto-HTTPS

#### Prerequisites
- Docker Hub image pushed
- Render.com account

#### Complete Setup

```bash
# 1. Sign up and login: https://render.com/dashboard

# 2. Create Web Service
#    - Dashboard → New → Web Service
#    - Docker environment
#    - Enter Docker image: YOUR-USERNAME/geofence-tracker-backend:latest
#    - Select Starter plan (free)
#    - Choose region (US East recommended, or closest to you)
#    - Auto-advance to environment variables

# 3. Add PostgreSQL Database
#    - Dashboard → New → PostgreSQL
#    - Name: geofence-db
#    - Database: geofence
#    - User: postgres
#    - Plan: Starter (free)
#    - Same region as backend service
#    - Create

# 4. Copy Database Connection String
#    - PostgreSQL instance → Info tab
#    - Copy "Internal Database URL"
#    - Format: postgresql://user:pass@host:5432/dbname

# 5. Set Backend Environment Variables
#    - Backend service → Environment
#    - Add variables:

DATABASE_URL=postgresql://...  # Paste from step 4
SEED_API_KEY=a7f3d9e4c2b1f8a6e5d4c3b2a1f9e8d7  # Generate: openssl rand -hex 16
PORT=8000

#    - Save

# 6. Deploy
#    - Backend service page shows deployment status
#    - Wait for "Deployed successfully"

# 7. Get Public URL
#    - Dashboard shows: https://geofence-backend-xyz.onrender.com

# 8. Test Backend
curl -H "X-API-Key: a7f3d9e4c2b1f8a6e5d4c3b2a1f9e8d7" \
  https://geofence-backend-xyz.onrender.com/geofences | jq

# 9. Enable Auto-Redeploy (Optional)
#    - Backend service → Settings
#    - Connect GitHub repo
#    - Auto-redeploys on git push
```

**Cost:** Free tier includes 750 compute hours/month (enough for 1 service)

---

### Option 2: Railway.app

**Why:** Good alternative, pay-as-you-go ($5 credit/month), fast setup

#### Complete Setup

```bash
# 1. Sign up: https://railway.app

# 2. New Project
#    - Dashboard → New Project
#    - Select "Docker" template

# 3. Add Backend Service
#    - New Service → Docker
#    - Choose "Deploy from Docker image"
#    - Image: YOUR-USERNAME/geofence-tracker-backend:latest
#    - Deploy

# 4. Add PostgreSQL Plugin
#    - Project → Add → PostgreSQL
#    - Railway auto-creates database

# 5. Set Environment Variables
#    - Backend service → Variables
#    - Railway auto-populates DATABASE_URL
#    - Add manually:

SEED_API_KEY=a7f3d9e4c2b1f8a6e5d4c3b2a1f9e8d7
PORT=8080

# 6. Deploy
#    - Railway auto-deploys

# 7. Get Public URL
#    - Project page shows service URL
#    - Format: https://railway-xyz.up.railway.app
```

**Cost:** $5 free credit/month, then pay-as-you-go (~$0.10-1.00/day for 1 service)

---

### Option 3: AWS EC2 + RDS

**Why:** Full control, scalable, but more complex setup

#### Complete Setup

```bash
# 1. Launch EC2 Instance
#    - AWS Console → EC2 → Launch Instance
#    - OS: Ubuntu 22.04 LTS (free eligible)
#    - Type: t2.micro (free eligible)
#    - Security Group: allow ports 22 (SSH), 80, 443
#    - Key pair: create and save privately
#    - Launch

# 2. SSH into instance
ssh -i /path/to/your-key.pem ubuntu@your-instance-public-ip

# 3. Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker ubuntu
exit  # Reconnect for group changes
ssh -i /path/to/your-key.pem ubuntu@your-instance-public-ip

# 4. Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" \
  -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
docker-compose --version  # Verify

# 5. Create RDS Database
#    - AWS Console → RDS → Create Database
#    - Engine: PostgreSQL 15.x
#    - Instance class: db.t3.micro (free eligible)
#    - DB name: geofence
#    - Master username: postgres
#    - Password: create strong password
#    - Public accessibility: Yes
#    - VPC security group: allow inbound 5432 from EC2 instance
#    - Create

# 6. Enable PostGIS Extension (optional, for geo queries)
psql -h your-rds-endpoint.rds.amazonaws.com -U postgres -d geofence
# At postgres prompt:
postgres# CREATE EXTENSION postgis;
postgres# \dx  # Verify installed
postgres# \q   # Exit

# 7. Create .env file on EC2
cat > /home/ubuntu/.env <<EOF
DATABASE_URL=postgresql://postgres:YourPassword@your-rds-endpoint.rds.amazonaws.com:5432/geofence?sslmode=require
SEED_API_KEY=a7f3d9e4c2b1f8a6e5d4c3b2a1f9e8d7
PORT=8080
EOF

# 8. Clone Repository
git clone https://github.com/YOUR-USERNAME/geofence-tracker.git
cd geofence-tracker

# 9. Start Services with Docker Compose
docker-compose up -d
docker ps  # Verify all containers running

# 10. Setup HTTPS with Let's Encrypt
sudo apt update && sudo apt install certbot python3-certbot-nginx -y
sudo certbot certonly --standalone -d your-domain.com
# Update nginx.conf with certificate paths
sudo systemctl restart nginx

# 11. Get Public IP
#     AWS Console → EC2 → Instances → Your Instance
#     Copy "Public IPv4 address"
#     Or use Elastic IP for static IP

# 12. Test Backend
curl -H "X-API-Key: a7f3d9e4c2b1f8a6e5d4c3b2a1f9e8d7" \
  http://your-public-ip:8080/geofences
```

**Cost:** Free tier (t2.micro, 750 hours/month) + RDS compute (~$0.29/day)

---

## Frontend Deployment Options

### Option 1: Vercel (🏆 RECOMMENDED)

**Why:** Free tier, global CDN, fastest builds, GitHub integration, auto-HTTPS

#### Prerequisites
- Code pushed to GitHub
- Vercel account

#### Complete Setup

```bash
# 1. Sign up and login: https://vercel.com/dashboard

# 2. Add New Project
#    - Dashboard → Add New → Project
#    - Select GitHub repo
#    - Choose "geofence-tracker"
#    - Framework: Vite
#    - Root Directory: frontend
#    - Build Command: npm run build
#    - Output Directory: dist
#    - Continue

# 3. Set Environment Variables
#    - Project Settings → Environment Variables
#    - Add each variable separately:

Key: VITE_API_URL
Value: https://geofence-backend-xyz.onrender.com
Environments: Production, Preview, Development

Key: VITE_WS_URL
Value: wss://geofence-backend-xyz.onrender.com
Environments: Production, Preview, Development

Key: VITE_API_KEY
Value: a7f3d9e4c2b1f8a6e5d4c3b2a1f9e8d7
Environments: Production, Preview, Development

#    - Save

# 4. Deploy
#    - Vercel auto-deploys
#    - Wait for build to complete
#    - Shows "Congratulations!"

# 5. Get Frontend URL
#    - Dashboard shows: https://your-project.vercel.app
#    - This is your public frontend URL

# 6. Setup Auto-Deploy (Enabled by Default)
#    - Every git push to main triggers new deployment
#    - No additional setup needed

# 7. Test Frontend
open https://your-project.vercel.app
# Should load instantly with global CDN
```

**Cost:** Free tier (unlimited deployments, 100GB bandwidth/month)

---

### Option 2: Netlify

**Why:** Free tier, GitHub integration, simple setup

#### Complete Setup

```bash
# 1. Sign up: https://netlify.com

# 2. Connect GitHub
#    - New site from Git
#    - Select GitHub provider
#    - Authorize Netlify
#    - Choose your repo

# 3. Configure Build
#    - Build command: npm run build
#    - Publish directory: dist
#    - Deploy

# 4. Add Environment Variables
#    - Site Settings → Build & Deploy → Environment
#    - Add variables:

VITE_API_URL=https://geofence-backend-xyz.onrender.com
VITE_WS_URL=wss://geofence-backend-xyz.onrender.com
VITE_API_KEY=a7f3d9e4c2b1f8a6e5d4c3b2a1f9e8d7

# 5. Redeploy
#    - Deploys → Trigger deploy → Deploy site

# 6. Get URL
#    - https://your-project.netlify.app
```

**Cost:** Free tier (unlimited deployments, 100GB bandwidth/month)

---

### Option 3: Cloudflare Pages

**Why:** Free tier, global CDN, unlimited bandwidth

#### Complete Setup

```bash
# 1. Sign up: https://pages.cloudflare.com

# 2. Connect GitHub
#    - Create project → GitHub
#    - Select your repo
#    - Select branch: main

# 3. Configure Build
#    - Framework: None (Vite builds to dist)
#    - Build command: npm run build
#    - Build output directory: dist

# 4. Add Environment Variables
#    - Settings → Environment variables
#    - Add:

VITE_API_URL=https://geofence-backend-xyz.onrender.com
VITE_WS_URL=wss://geofence-backend-xyz.onrender.com
VITE_API_KEY=a7f3d9e4c2b1f8a6e5d4c3b2a1f9e8d7

# 5. Save & Deploy
#    - Cloudflare auto-deploys

# 6. Get URL
#    - https://your-project.pages.dev
```

**Cost:** Free tier (unlimited bandwidth, global CDN)

---

## Environment Variables Reference

### Backend Environment Variables (CRITICAL)

```env
# ========================================
# REQUIRED - Backend will not start without these
# ========================================

# PostgreSQL database connection
# Format: postgresql://user:password@host:port/database?sslmode=require
# Get from: Render PostgreSQL or AWS RDS console
DATABASE_URL=postgresql://user:pass@dpg-xyz.render.internal:5432/geofence?sslmode=require

# API server port (optional, default varies by platform)
# Render default: 10000
# Railway default: 8080
# AWS EC2: 8080
PORT=8000

# Secret API key (minimum 32 characters)
# Generate: openssl rand -hex 16
# This MUST match VITE_API_KEY on frontend
SEED_API_KEY=a7f3d9e4c2b1f8a6e5d4c3b2a1f9e8d7
```

### Render PostgreSQL Connection Example

```bash
# Render PostgreSQL Instance → Info
# Internal Database URL (use for Render-to-Render connection):
postgresql://postgres:random_password@dpg-abc123abc.internal:5432/geofence?sslmode=require

# External Database URL (if connecting from outside Render):
postgresql://postgres:random_password@dpg-abc123abc.render.internal:5432/geofence?sslmode=require
```

### AWS RDS Connection Example

```bash
# AWS RDS → Databases → Your Instance → Connectivity & security
# Endpoint: geofence-db.c1xyz.us-east-1.rds.amazonaws.com
# Port: 5432
# Master username: postgres
# Master password: [your password]

# Format:
postgresql://postgres:YourPassword@geofence-db.c1xyz.us-east-1.rds.amazonaws.com:5432/geofence?sslmode=require
```

### Frontend Environment Variables (CRITICAL)

```env
# ========================================
# REQUIRED - Frontend build will include these
# ========================================

# Backend API base URL (no trailing slash!)
# Point to your deployed backend
VITE_API_URL=https://geofence-backend-xyz.onrender.com

# WebSocket URL
# Use wss:// for HTTPS backends
# Use ws:// for HTTP backends only (NOT RECOMMENDED for production)
VITE_WS_URL=wss://geofence-backend-xyz.onrender.com

# API key (MUST match backend SEED_API_KEY exactly!)
VITE_API_KEY=a7f3d9e4c2b1f8a6e5d4c3b2a1f9e8d7
```

### Vercel Environment Variable Setup

```bash
# Vercel Dashboard → Your Project → Settings → Environment Variables

# Add each variable:
# Key: VITE_API_URL
# Value: https://geofence-backend-xyz.onrender.com
# Environments: ✓ Production  ✓ Preview  ✓ Development
# Save

# Key: VITE_WS_URL
# Value: wss://geofence-backend-xyz.onrender.com
# Environments: ✓ Production  ✓ Preview  ✓ Development
# Save

# Key: VITE_API_KEY
# Value: a7f3d9e4c2b1f8a6e5d4c3b2a1f9e8d7
# Environments: ✓ Production  ✓ Preview  ✓ Development
# Save

# After changing variables, redeploy:
# Deployments → Trigger Deploy → Deploy Site
```

---

## Complete Deployment Checklist

Use this checklist to ensure every deployment requirement is met.

### ✅ Pre-Deployment (Local Testing)

```
[ ] Frontend builds without errors: npm run build
[ ] Backend compiles: go build ./cmd/server
[ ] Docker images build successfully
[ ] docker-compose up starts all services
[ ] All containers healthy: docker ps shows "Up"
[ ] Database migrations applied
[ ] Seed data created
[ ] API endpoints tested locally with curl
[ ] WebSocket /ws/alerts connects
[ ] Frontend connects to backend (no console errors)
[ ] Create geofence via UI
[ ] Register vehicle via UI
[ ] Move vehicle triggers alerts
[ ] Real-time alerts appear in feed
```

### ✅ Docker Hub Deployment

```
[ ] Docker Hub account created: https://hub.docker.com
[ ] Repository created: username/geofence-tracker-backend
[ ] Repository set to PUBLIC
[ ] docker login succeeds locally
[ ] Backend image built: docker build -t username/geofence-tracker-backend:latest ./backend
[ ] Image pushed: docker push username/geofence-tracker-backend:latest
[ ] Image visible on Docker Hub
[ ] Image pull works: docker pull username/geofence-tracker-backend:latest
[ ] Version tag added (optional): :v1.0.0
```

### ✅ Backend Deployment

**If using Render.com:**
```
[ ] Render account created: https://render.com
[ ] Web Service created (Docker environment)
[ ] Docker image URL set correctly
[ ] Region selected (low latency)
[ ] Plan selected (Starter free or higher)
[ ] PostgreSQL database added
[ ] Database connection string copied
[ ] DATABASE_URL set to PostgreSQL connection
[ ] SEED_API_KEY set to secure value
[ ] PORT set correctly
[ ] Backend deployed successfully (status: "Live")
[ ] Public URL obtained: https://geofence-backend-xyz.onrender.com
[ ] Health check works: curl https://geofence-backend-xyz.onrender.com/health
[ ] API responds: curl -H "X-API-Key: key" https://...backend.../geofences | jq
[ ] Response includes time_ns field
[ ] Logs show no errors
```

**If using alternative platform:**
```
[ ] Backend deployed on chosen platform
[ ] Public URL obtained and tested
[ ] Database connected and migrated
[ ] Environment variables set correctly
[ ] HTTPS enabled
[ ] No 502/503 errors
[ ] Logs show successful startup
```

### ✅ Frontend Deployment

**If using Vercel:**
```
[ ] Vercel account created: https://vercel.com
[ ] GitHub repo connected to Vercel
[ ] Frontend directory set to frontend/
[ ] Build command: npm run build
[ ] Output directory: dist
[ ] VITE_API_URL set to backend URL
[ ] VITE_WS_URL set to WebSocket URL (wss://)
[ ] VITE_API_KEY set to backend SEED_API_KEY
[ ] Frontend deployed successfully
[ ] Public URL obtained: https://your-project.vercel.app
[ ] Build logs show no errors
[ ] Frontend loads in browser (no "Loading..." stuck)
[ ] No console errors
```

**If using alternative platform:**
```
[ ] Frontend deployed on chosen platform
[ ] Public URL obtained
[ ] Environment variables set
[ ] Build succeeds
[ ] Frontend loads in browser
```

### ✅ Integration Testing

```
[ ] Frontend loads without network errors
[ ] API key displays correctly
[ ] Geofence tab loads
[ ] Create geofence form works
[ ] Geofence appears in list
[ ] Console shows API response with time_ns
[ ] Vehicles tab loads
[ ] Register vehicle succeeds
[ ] Vehicle appears in list
[ ] Manual location update works
[ ] Geofence detection triggers
[ ] Alerts tab loads
[ ] Create alert rule succeeds
[ ] Move vehicle into geofence
[ ] Alert notification appears (toast)
[ ] Alert added to feed
[ ] WebSocket connection visible in DevTools
[ ] History tab shows violations
[ ] Delete functions work
```

### ✅ API Response Format Verification

Every API response must include `time_ns` field.

```bash
BACKEND="https://geofence-backend-xyz.onrender.com"
API_KEY="your-api-key"

# Test each endpoint - all should include "time_ns"
curl -H "X-API-Key: $API_KEY" $BACKEND/geofences | jq '.time_ns'
curl -H "X-API-Key: $API_KEY" $BACKEND/vehicles | jq '.time_ns'
curl -H "X-API-Key: $API_KEY" $BACKEND/alerts | jq '.time_ns'
curl -H "X-API-Key: $API_KEY" $BACKEND/violations/history | jq '.time_ns'

# Verify response format:
# {
#   "success": true,
#   "data": [ ... ],
#   "time_ns": 1234567890
# }
```

```
[ ] All responses include time_ns (nanoseconds)
[ ] All responses have success field
[ ] All responses have data field
[ ] Error responses follow same format
```

### ✅ Security & Configuration

```
[ ] API key changed from dev-secret-key-change-me
[ ] API key stored in env vars, not hardcoded
[ ] No secrets in GitHub repo
[ ] .gitignore prevents .env commits
[ ] Both frontend and backend use HTTPS
[ ] WebSocket uses wss:// for HTTPS
[ ] Database password changed from default
[ ] Database connection uses sslmode=require
```

### ✅ GitHub Repository

```
[ ] Private repo created on GitHub
[ ] Code pushed to main branch
[ ] .gitignore includes .env
[ ] No .env file committed
[ ] README.md exists with live URLs
[ ] All documentation files present
[ ] Collaborators added with Maintainer role
```

### ✅ Documentation

```
[ ] README.md includes project overview, architecture, live URLs
[ ] SETUP.md includes local development guide
[ ] DEPLOYMENT*.md files comprehensive and clear
[ ] GITHUB_SETUP.md includes Git workflow
[ ] DOCKER_HUB_GUIDE.md includes Docker Hub setup
```

### ✅ Performance Verification

```
[ ] Backend response time < 500ms for typical calls
[ ] WebSocket connects within 2 seconds
[ ] Frontend page loads within 3 seconds
[ ] No memory leaks (test running overnight)
[ ] Database queries optimized (< 100ms)
[ ] Rate limiting working correctly
```

### ✅ Error Handling

```
[ ] Invalid API key returns 401 Unauthorized
[ ] Missing geofence returns 404 Not Found
[ ] Invalid coordinates handled gracefully
[ ] Database errors show meaningful messages
[ ] Frontend displays user-friendly errors
[ ] No stack traces exposed to client
```

---

## Troubleshooting Guide

### Backend Issues

#### Issue: "Can't connect to backend from frontend"

**Symptoms:**
- Frontend shows "Connection refused" or network error
- DevTools shows 404/500 errors
- Console: "Access origin not allowed"

**Solutions:**

1. **Check backend URL is correct:**
   ```bash
   # Verify backend is running
   curl https://geofence-backend-xyz.onrender.com/health
   
   # Should return 200 OK (or 401 with API key)
   ```

2. **Verify environment variable matches exactly:**
   ```bash
   # On Vercel, check Environment Variables
   # VITE_API_URL should be: https://geofence-backend-xyz.onrender.com
   # (no trailing slash!)
   ```

3. **Check firewall/security groups:**
   - AWS EC2: Security group allows port 8080/443
   - Render: Backend service is public
   - Railway: Port exposed correctly

---

#### Issue: "502 Bad Gateway" from deployment platform

**Symptoms:**
- Browser shows "502 Bad Gateway"
- Backend service shows "crashed"

**Solutions:**

1. **Check logs:**
   ```bash
   # Render
   Render Dashboard → Backend Service → Logs
   
   # Railway
   railway logs
   
   # EC2
   ssh into instance
   docker logs -f geofence_backend
   ```

2. **Common causes:**
   - Missing DATABASE_URL → "database connection failed"
   - Wrong PORT → "port already in use"
   - Invalid migrations → "table doesn't exist"

3. **Fix and redeploy:**
   ```bash
   # Fix .env file
   # Rebuild image
   docker build -t user/geofence-tracker-backend:latest ./backend
   docker push user/geofence-tracker-backend:latest
   
   # Render: Auto-redeploys with new image
   # Railway: Trigger manual redeploy
   # EC2: Pull new image, restart container
   ```

---

#### Issue: "401 Unauthorized" on API calls

**Symptoms:**
- curl returns {"success": false, "error": "unauthorized"}
- API key header not recognized

**Solutions:**

1. **Verify API keys match exactly:**
   ```bash
   # Backend
   echo $SEED_API_KEY
   
   # Frontend
   echo $VITE_API_KEY
   
   # They MUST be identical
   ```

2. **Test with curl:**
   ```bash
   curl -H "X-API-Key: your-api-key" \
     https://backend-url.com/geofences
   ```

3. **Generate new key if uncertain:**
   ```bash
   openssl rand -hex 16
   # Set this as:
   # Backend: SEED_API_KEY
   # Frontend: VITE_API_KEY
   # Redeploy both
   ```

---

### Frontend Issues

#### Issue: "Can't connect to WebSocket"

**Symptoms:**
- DevTools Network tab → WS: shows connection failed
- Alerts not updating in real-time
- Console: "WebSocket connection failed"

**Solutions:**

1. **Check WebSocket URL format:**
   ```bash
   # HTTPS backend → use wss://
   VITE_WS_URL=wss://geofence-backend-xyz.onrender.com
   
   # HTTP backend → use ws://
   VITE_WS_URL=ws://backend-url  # NOT recommended for production
   ```

2. **Verify backend supports WebSocket:**
   ```bash
   # Test with curl (won't work, but shows connection attempt)
   curl -i -N -H "Connection: Upgrade" \
     -H "Upgrade: websocket" \
     https://backend-url.com/ws/alerts
   ```

3. **Redeploy frontend after fixing:**
   - Update VITE_WS_URL
   - Push to GitHub
   - Vercel auto-redeploys

---

#### Issue: "Frontend stuck on Loading..."

**Symptoms:**
- Page loads but shows "Loading..." indefinitely
- API calls never complete
- Console: timeout errors

**Solutions:**

1. **Check VITE_API_URL:**
   ```bash
   # Open DevTools → Applications → Environment Variables
   # VITE_API_URL should be exact backend URL
   # No trailing slash!
   ```

2. **Test backend connectivity:**
   ```bash
   # From browser console
   fetch('https://backend-url/health')
     .then(r => console.log(r))
     .catch(e => console.error(e))
   ```

3. **Check backend is running:**
   ```bash
   curl https://backend-url/health
   ```

---

#### Issue: "Build fails on Vercel"

**Symptoms:**
- Vercel shows red X on deployment
- Build logs show errors

**Solutions:**

1. **Check build command was set:**
   - Vercel → Settings → Build & Deploy
   - Build command: `npm run build`
   - Output directory: `dist`

2. **Fix TypeScript/syntax errors (if any):**
   ```bash
   # Build locally first
   cd frontend
   npm run build
   # Fix any errors shown
   git push
   ```

3. **Check environment variables:**
   - All VITE_* variables present and correct

---

### Database Issues

#### Issue: "Database connection failed"

**Symptoms:**
- Backend logs: "can't connect to database"
- Backend crashes on startup

**Solutions:**

1. **Check DATABASE_URL format:**
   ```bash
   # Correct format:
   postgresql://user:password@host:port/dbname?sslmode=require
   
   # Common mistakes:
   # - Missing ?sslmode=require
   # - Wrong port (should be 5432 for PostgreSQL)
   # - Wrong host (use Render internal URL, not external)
   ```

2. **Test connection locally:**
   ```bash
   # Get connection string from platform
   psql postgresql://user:pass@host:5432/dbname?sslmode=require
   # Should connect to database
   ```

3. **Verify database exists:**
   - Render: PostgreSQL instance created
   - AWS: RDS instance created with database
   - Railway: PostgreSQL plugin added

---

#### Issue: "Missing tables" or "migration failed"

**Symptoms:**
- Backend logs: "table doesn't exist"
- API returns 500 errors

**Solutions:**

1. **Check migrations ran:**
   ```bash
   # If migrations are in Docker image, should run automatically
   # Check backend logs:
   docker logs geofence_backend | grep -i migration
   ```

2. **Seed database manually if needed:**
   ```bash
   # Connect to database
   psql $DATABASE_URL < seed.sql
   ```

3. **Redeploy backend (should run migrations on startup):**
   ```bash
   # If migrations are in code
   docker push user/geofence-tracker-backend:latest
   # Platform redeploys and applies migrations
   ```

---

### Docker Hub Issues

#### Issue: "denied: requested access to the resource is denied"

**Symptoms:**
- `docker push` fails with access denied

**Solutions:**

1. **Verify logged in:**
   ```bash
   docker login
   # Enter credentials
   ```

2. **Check repository name matches:**
   ```bash
   # Must be: YOUR-DOCKER-HUB-USERNAME/repo-name
   docker build -t YOUR-USERNAME/geofence-tracker-backend:latest ./backend
   
   # Check on Docker Hub:
   # https://hub.docker.com/r/YOUR-USERNAME
   ```

3. **Verify repository is PUBLIC:**
   - Docker Hub → Repository → Settings → Visibility
   - Change to Public if needed

---

#### Issue: "Image too large" or slow push

**Symptoms:**
- `docker build` takes long time
- `docker push` times out

**Solutions:**

1. **Check image size:**
   ```bash
   docker images YOUR-USERNAME/geofence-tracker-backend
   # Should be ~160MB (already optimized)
   ```

2. **If too large, check Dockerfile:**
   - Backend Dockerfile already uses multi-stage build
   - Frontend Dockerfile uses node:alpine

3. **Reduce build context:**
   ```bash
   # Ensure .dockerignore exists
   cat backend/.dockerignore
   # Should exclude node_modules, .git, etc.
   ```

---

## API Response Verification

Every API response must follow this format:

```json
{
  "success": true,
  "data": {
    "id": "...",
    "name": "...",
    "created_at": "..."
  },
  "time_ns": 1234567890000000000
}
```

### Verify All Endpoints

```bash
#!/bin/bash

BACKEND="https://geofence-backend-xyz.onrender.com"
API_KEY="your-api-key"

echo "Testing API Response Format..."

# Test 1: Geofences
echo "1. /geofences"
curl -s -H "X-API-Key: $API_KEY" $BACKEND/geofences | jq '.time_ns'

# Test 2: Vehicles
echo "2. /vehicles"
curl -s -H "X-API-Key: $API_KEY" $BACKEND/vehicles | jq '.time_ns'

# Test 3: Alerts
echo "3. /alerts"
curl -s -H "X-API-Key: $API_KEY" $BACKEND/alerts | jq '.time_ns'

# Test 4: Violations History
echo "4. /violations/history"
curl -s -H "X-API-Key: $API_KEY" $BACKEND/violations/history | jq '.time_ns'

echo "All endpoints should show numeric time_ns values above"
```

### Response Format Requirements Checklist

```
[ ] success field present (true/false)
[ ] data field present (array or object)
[ ] time_ns field present (nanoseconds since epoch)
[ ] time_ns is numeric (not string)
[ ] time_ns is large number (> 1600000000000000000)
[ ] All error responses follow same format
[ ] No HTML or error stack traces in response
```

---

## Post-Deployment Tasks

### 1. Share with Reviewers

```bash
# Send these details:
# 1. GitHub Repository Link
#    https://github.com/YOUR-USERNAME/geofence-tracker
#
# 2. Frontend Live URL
#    https://your-project.vercel.app
#
# 3. Backend API URL
#    https://geofence-backend-xyz.onrender.com
#
# 4. API Key (if accessing programmatically)
#    [Your SEED_API_KEY]
```

### 2. Enable Continuous Deployment

```bash
# Render
# Backend service → Settings → Auto-Deploy
# Connect GitHub repo → Deploy on every push

# Vercel
# Already auto-deploys on git push (enabled by default)

# EC2 / Manual
# Setup GitHub webhook or manual redeploy script
```

### 3. Monitor Deployments

```bash
# Render Dashboard
# - Check service status
# - Review logs regularly
# - Set up alerts for crashes

# Vercel Dashboard
# - Monitor build/deployment status
# - Check analytics
# - Review performance metrics
```

### 4. Regular Maintenance

```bash
# Weekly
- [ ] Check logs for errors
- [ ] Verify all endpoints responding
- [ ] Test WebSocket connectivity

# Monthly
- [ ] Update dependencies (npm update, go get)
- [ ] Review security advisories
- [ ] Test full end-to-end workflow

# As needed
- [ ] Update API response format if requirements change
- [ ] Optimize slow database queries
- [ ] Scale infrastructure if needed
```

---

## Quick Reference

### Most Important Concepts

1. **Docker Hub is the Bridge**
   ```
   Your Computer (Local Build)
        ↓
   Docker Image
        ↓
   Docker Hub (Storage)
        ↓
   Cloud Platform (Pull & Run)
   ```

2. **Environment Variables Are Critical**
   ```
   Backend: DATABASE_URL, SEED_API_KEY, PORT
   Frontend: VITE_API_URL, VITE_WS_URL, VITE_API_KEY
   
   If these don't match, deployment fails!
   ```

3. **API Key Must Match Everywhere**
   ```
   Backend SEED_API_KEY    = "abc123def456"
   Frontend VITE_API_KEY   = "abc123def456"  ← EXACT SAME
   Requests: -H "X-API-Key: abc123def456"
   ```

4. **WebSocket Protocol Matters**
   ```
   HTTPS Backend → wss://  (secure WebSocket)
   HTTP Backend  → ws://   (unencrypted, not for production!)
   ```

5. **API Response Format is Non-Negotiable**
   ```json
   {
     "success": true,
     "data": { ... },
     "time_ns": 1234567890000000000
   }
   ```

### Platform Decision Matrix

| Question | Answer | Recommendation |
|----------|--------|-----------------|
| Want simplest setup? | Yes | Use Render.com + Vercel |
| Need custom control? | Yes | Use AWS EC2 + RDS |
| Want free forever? | Yes | Render free tier + Vercel free tier |
| Expected high traffic? | Yes | AWS, Railway, or DigitalOcean |
| First deployment? | Yes | Follow Render + Vercel path |

### Command Cheat Sheet

```bash
# Build Docker image
docker build -t YOUR-USERNAME/geofence-tracker-backend:latest ./backend

# Push to Docker Hub
docker push YOUR-USERNAME/geofence-tracker-backend:latest

# Test local deployment
docker-compose up -d
docker ps

# Test API
curl -H "X-API-Key: your-key" https://backend-url/geofences | jq

# Generate secure API key
openssl rand -hex 16

# SSH into EC2
ssh -i your-key.pem ubuntu@your-ip

# View Docker logs
docker logs -f container-name

# Check PostgreSQL connection
psql $DATABASE_URL -c "SELECT COUNT(*) FROM geofences;"
```

---

## Frequently Asked Questions

**Q: How much will this cost?**
A: Free tier for 1-3 months, then ~$5-10/month if you choose paid tiers. Everything can start free.

**Q: Can I change platforms later?**
A: Yes! Requirements is that image exists on Docker Hub, so you can pull and run on any platform.

**Q: What if backend goes down?**
A: Render/Railway have auto-restart. EC2 requires manual setup or monitoring service.

**Q: How do I update my code after deployment?**
A: For Render/Railway with GitHub connected: `git push main` auto-deploys. For EC2: manual pull + restart.

**Q: Is WebSocket required?**
A: Yes, for real-time alerts. All major platforms support it.

**Q: Can I use my own domain?**
A: Yes! All platforms support custom domains (may require paid tier or DNS setup).

**Q: Where are my users' data stored?**
A: In PostgreSQL database on Render/AWS managed database.

**Q: How do I backup my database?**
A: Render/Railway auto-backup. EC2/RDS: enable automated backups in console.

**Q: What if I exceed free tier limits?**
A: Render/Vercel charge overage fees (can set spending limits). Railway uses credit system.

---

## Additional Resources

- **Render Documentation:** https://render.com/docs
- **Vercel Documentation:** https://vercel.com/docs
- **AWS EC2 Guide:** https://docs.aws.amazon.com/ec2/
- **Docker Documentation:** https://docs.docker.com/
- **PostgreSQL Guide:** https://www.postgresql.org/docs/
- **Go WebSocket:** https://github.com/gorilla/websocket

---

**Last Updated:** April 2026

**Questions?** Refer to [Troubleshooting Guide](#troubleshooting-guide) or check deployment platform documentation.
