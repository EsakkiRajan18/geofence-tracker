# GitHub Setup & Security Guide

## Creating Your Private Repository

### Step 1: Create Repository

1. Go to https://github.com/new
2. Repository name: `geofence-tracker`
3. **Select "Private"** ⚠️ CRITICAL
4. Add description: "Real-time geofence tracking system with React + Go + PostgreSQL"
5. Create repository

### Step 2: Push Your Code

```bash
cd /path/to/geofence-tracker

# Initialize git (if not already done)
git init
git add .
git commit -m "Initial commit: geofence-tracker full stack application"

# Add remote
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/geofence-tracker.git

# Push
git push -u origin main

# Verify on GitHub
# https://github.com/YOUR-USERNAME/geofence-tracker
```

### Step 3: Add Collaborators

1. GitHub repo → Settings → Collaborators
2. Click "Add people"
3. Enter reviewer email/username
4. Select role:
   - **Maintainer** (full access) — for instructors/evaluators
   - **Developer** (code access) — for team members
5. Send invite

---

## .gitignore Setup

Create `.gitignore` to prevent secrets from being pushed:

```bash
# Create file
cat > .gitignore <<EOF
# Environment variables (NEVER commit these!)
.env
.env.local
.env.*.local
.env.production.local
*.key
secrets.json

# Dependencies
node_modules/
go.sum

# Build outputs
dist/
build/
/backend/server
/backend/*.exe

# IDE
.vscode/
.idea/
*.swp
*.swo
*~
.DS_Store

# Logs
logs/
*.log
npm-debug.log*

# Temporary files
temp/
tmp/
*.tmp

# Database files
*.db
*.sqlite
pgdata/

# Node
.npm
package-lock.json

# Go
*.out
vendor/

# Docker
.dockerignore
EOF

git add .gitignore
git commit -m "Add comprehensive gitignore"
git push
```

---

## Secret Management

### ❌ NEVER Commit

```bash
# DON'T commit these:
SEED_API_KEY=real-secret-123
DATABASE_URL=postgresql://user:password@host:5432/db
AWS_ACCESS_KEY=AKIAIOSFODNN7EXAMPLE
```

### ✅ DO Commit

```bash
# Commit only templates/examples:
.env.example  ← Safe to commit
docker-compose.example.yml  ← Safe to commit
README.md with explanations  ← Safe to commit
```

### Use Environment Variables

```bash
# Local development
# Create .env (not committed)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/geofence?sslmode=disable
SEED_API_KEY=dev-secret-key-change-me

# Load in development
source .env
go run ./cmd/server

# Production (set in hosting platform, NOT in repo)
# Render.com → Web Service → Environment variables
# Railway.app → Deploy → Variables
# Vercel → Settings → Environment variables
```

---

## Repository Structure Best Practice

```
geofence-tracker/
├── backend/
│   ├── cmd/
│   │   └── server/
│   │       └── main.go
│   ├── internal/
│   │   ├── api/
│   │   ├── db/
│   │   ├── middleware/
│   │   ├── models/
│   │   └── websocket/
│   ├── migrations/
│   ├── .env.example         ← Safe to commit
│   ├── Dockerfile
│   ├── go.mod
│   ├── go.sum
│   └── server               ← Goignore: built binary
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── api/
│   │   └── main.jsx
│   ├── .env.example         ← Safe to commit
│   ├── Dockerfile
│   ├── package.json
│   ├── vite.config.js
│   └── dist/                ← Gitignore: build output
│
├── .gitignore               ← Security critical
├── docker-compose.yml
├── nginx.conf
│
├── README.md                ← Replace with your info
├── SETUP.md                 ← Setup instructions
├── DEPLOYMENT.md            ← Deployment guide
├── DEPLOYMENT_QUICK_START.md ← Quick start
│
└── .github/
    └── workflows/           ← Optional: CI/CD pipeline
        └── deploy.yml
```

---

## Branch Strategy

### Main Branch (Production Ready)

```bash
# Only stable, tested code
# Protected branch: require reviews before merge
git checkout main
git pull
# ... make changes ...
git push
```

### Development Branch (Optional)

```bash
# For features/fixes before merging to main
git checkout -b develop
# ... make changes ...
git push origin develop

# Create Pull Request on GitHub
# Review, test, merge to main
```

---

## Repository Settings to Secure

1. **Settings → Branches**
   - ✅ Require pull request reviews before merging
   - ✅ Require status checks to pass
   - ✅ Dismiss stale pull request approvals

2. **Settings → Secrets and variables**
   - Add any GitHub Actions secrets here (not in repo)

3. **Settings → Security & analysis**
   - ✅ Dependabot alerts (optional)
   - ✅ Code scanning (optional)

---

## Commit Message Convention

Good commit messages help track changes:

```bash
# Feature
git commit -m "feat: add geofence shape validation"

# Fix
git commit -m "fix: WebSocket connection timeout issue"

# Docs
git commit -m "docs: update SETUP.md deployment section"

# Deployment
git commit -m "deploy: push Docker image to Hub, deploy to Render"

# Refactor
git commit -m "refactor: consolidate database queries"
```

---

## Sharing Repository with Reviewers

### Option 1: Add as Collaborator (Preferred)

```bash
# Private repo → Settings → Collaborators
# Send invite to: reviewer@example.com
# Role: Maintainer
# → Reviewer now has full access
```

### Option 2: Create Deploy Key (GitHub Actions)

```bash
# For CI/CD pipelines
# Settings → Deploy keys
# Add public key from your CI/CD system
```

---

## .github/workflows/ (Optional CI/CD)

Create automated tests on every push:

```bash
mkdir -p .github/workflows

cat > .github/workflows/test.yml <<EOF
name: Tests

on: [push, pull_request]

jobs:
  backend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-go@v4
        with:
          go-version: '1.21'
      - run: cd backend && go test ./...

  frontend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: cd frontend && npm install && npm run build
EOF

git add .github/workflows/test.yml
git commit -m "ci: add GitHub Actions for automated tests"
git push
```

---

## Common GitHub Issues

| Issue | Solution |
|-------|----------|
| "Push rejected" | `git pull` to sync, then push |
| "Credential error" | Use [GitHub token](https://github.com/settings/tokens) instead of password |
| "Can't push to repo" | Check collaborator role or branch protection |
| ".env committed by mistake" | Use [BFG Repo-Cleaner](https://rtyley.github.io/bfg-repo-cleaner/) to remove |

---

## How Reviewers Access Your Code

1. ✅ Receive collaborator invite email
2. ✅ Accept invite
3. ✅ Access private repo at: https://github.com/YOUR-USERNAME/geofence-tracker
4. ✅ Download code: `git clone ...`
5. ✅ Run locally: `docker-compose up`
6. ✅ Access live deployment links

---

## Sharing Live URLs After Deployment

After deploying to Render/Vercel:

```bash
# Update README.md with live links
cat > README_DEPLOYMENT.md <<EOF
# Geofence Tracker — Live Deployment

## 🌐 Live Application
- **Frontend:** https://your-project.vercel.app
- **Backend API:** https://geofence-backend-xyz.onrender.com
- **API Key:** [provided to reviewers]

## 📹 Demo
1. Open frontend link
2. Create a geofence
3. Register a vehicle
4. Move vehicle to trigger geofence events
5. See real-time alerts

## 👁️ Code Review
- **GitHub:** https://github.com/YOUR-USERNAME/geofence-tracker
- **Collaborators:** [email]
EOF
```

---

## Security Best Practices Summary

✅ **DO:**
- Keep repo private until approved
- Use .env for sensitive variables
- Add .gitignore before first commit
- Rotate API keys regularly
- Enable 2FA on GitHub account
- Use HTTPS for all URLs

❌ **DON'T:**
- Commit .env files
- Use placeholder secrets in code
- Share API keys in chat/email
- Push database passwords
- Make repo public until approval
- Hardcode configuration values

---

## Final Verification

```bash
# Before final push:

# 1. Check no secrets in recent commits
git log --name-only --oneline | head -20

# 2. Verify .gitignore working
git check-ignore -v .env

# 3. Check for accidentally added secrets
git grep -i -E "password|secret|key|token" -- ':/*' ':(exclude).gitignore'

# 4. All good! Push
git push
```

---

**Ready to share?** Provide reviewers with:
1. GitHub repo link (they'll be added as collaborators)
2. Live frontend URL
3. API documentation (in repo)
