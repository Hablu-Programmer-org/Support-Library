# Self-Hosted Deployment Guide

This guide covers deploying Support Library to various platforms using Docker Compose.

## Prerequisites

- Docker 24+ and Docker Compose v2+
- MongoDB 7+ (replica set required for transactions)
- Google Cloud Console OAuth credentials
- Domain name with DNS control (for production TLS)

## Quick Start (Development)

```bash
# 1. Clone and configure
git clone https://github.com/your-org/support-library.git
cd support-library
cp .env.example .env.local
# Edit .env.local with your values

# 2. Start MongoDB replica set (required for transactions)
docker run -d --name mongo-rs \
  -p 27017:27017 \
  mongo:8.0 --replSet rs0 --bind_ip_all

docker exec mongo-rs mongosh --eval 'rs.initiate({_id:"rs0",members:[{_id:0,host:"127.0.0.1:27017"}]})'

# 3. Build and start (binds only to 127.0.0.1:12000 by default)
docker compose -f compose.example.yml up -d --build

# 4. Verify
curl http://localhost:12000/api/health/live
curl http://localhost:12000/api/health/ready
```

## Production Deployment

### 1. Prepare Environment

```bash
# Copy example configs
cp compose.example.yml compose.yml
cp .env.example .env.production
```

### 2. Configure `.env.production`

Required variables:
```env
# MongoDB
MONGODB_URI=mongodb://user:pass@host1:27017,host2:27017,host3:27017/?replicaSet=rs0
MONGODB_DB=support_library
LMS_MONGODB_URI=mongodb://readonly_user:pass@host1:27017,host2:27017,host3:27017/?replicaSet=rs0
LMS_MONGODB_DB=hp-v2

# Auth.js v5
AUTH_SECRET=<generate with: npx auth secret>
AUTH_GOOGLE_ID=<from Google Cloud Console>
AUTH_GOOGLE_SECRET=<from Google Cloud Console>
AUTH_URL=https://support.your-domain.com
AUTH_TRUST_HOST=true

# App
NEXT_PUBLIC_APP_URL=https://support.your-domain.com
NODE_ENV=production

# External links (HTTPS is always required)
ALLOWED_LINK_HOSTS=your-domain.com,cdn.your-domain.com
# Video links per issue/reply: 1-50; invalid/missing falls back to 10
MAX_LINKS_PER_ITEM=10

# Optional: cross-app nav link to the main LMS frontend (HTTPS required).
# Unset = the "My Courses" item is not rendered. Baked in at build time by
# Next.js, so set it before `next build`.
NEXT_PUBLIC_LMS_URL=https://www.your-domain.com
```

Optional live support overrides (unset = the standing Zoom room). These are
resolved on the server and only reach a browser of a signed-in user, so never
log them. `npm run check:live-support` confirms they still match the LMS
frontend's own copy.

```env
LIVE_SUPPORT_PLATFORM=Zoom
LIVE_SUPPORT_JOIN_URL=https://your-org.zoom.us/j/1234567890?pwd=...
LIVE_SUPPORT_MEETING_ID=123 456 7890
LIVE_SUPPORT_PASSCODE=abc123
```

### 3. Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create OAuth 2.0 Client ID (Web application)
3. Authorized redirect URI: `https://support.your-domain.com/api/auth/callback/google`
4. Authorized JavaScript origins: `https://support.your-domain.com`
5. Copy Client ID and Secret to `.env.production`

### 4. Deploy with Traefik (Recommended)

```bash
# Create external network for Traefik
docker network create proxy

# Deploy
docker compose -f compose.yml -f compose.traefik.yml up -d --build

# Verify
curl https://support.your-domain.com/api/health/ready
```

### 5. Deploy without Traefik (Direct Port)

```bash
docker compose up -d --build

# The default host mapping is 127.0.0.1:12000:12000. Configure nginx or
# Caddy to proxy to localhost:12000. Set SUPPORT_LIBRARY_BIND_ADDRESS only
# when a different bind address is intentionally required.
```

## Platform-Specific Guides

### Vercel

1. Connect GitHub repository to Vercel
2. Add environment variables in Vercel dashboard
3. Set build command: `npm run build`
4. Set output directory: `.next`
5. Deploy

**Note:** Vercel doesn't support Docker. Use the Node.js build output.

### Railway

1. Create new project from GitHub repo
2. Add MongoDB plugin
3. Add environment variables
4. Set Dockerfile path: `./Dockerfile`
5. Deploy

### Render

1. Create new Web Service from GitHub
2. Runtime: Docker
3. Add environment variables
4. Add persistent disk for `/tmp` if needed
5. Deploy

### Coolify

1. Add new application from GitHub
2. Set compose file: `compose.yml`
3. Add environment variables
4. Enable Traefik integration
5. Deploy

### Docker Compose (Standalone VPS)

```bash
# On your VPS
mkdir -p /opt/support-library
cd /opt/support-library

# Copy compose.yml, compose.traefik.yml, .env.production
# (Use rsync, scp, or git clone)

docker compose -f compose.yml -f compose.traefik.yml up -d --build
```

## Database Setup

### MongoDB Replica Set (Required)

```javascript
// Initialize replica set
rs.initiate({
  _id: "rs0",
  members: [
    { _id: 0, host: "mongo1:27017" },
    { _id: 1, host: "mongo2:27017" },
    { _id: 2, host: "mongo3:27017" }
  ]
})

// Create database user
use admin
db.createUser({
  user: "support_app",
  pwd: "secure_password",
  roles: [
    { role: "readWrite", db: "support_library" }
  ]
})

// Create read-only user for LMS (hp-v2)
use hp-v2
db.createUser({
  user: "lms_readonly",
  pwd: "secure_password",
  roles: [
    { role: "read", db: "hp-v2" }
  ]
})
```

### Indexes

After first deploy, run:
```bash
docker compose run --rm ops npm run db:indexes -- --apply --create-only
docker compose run --rm ops npm run db:indexes -- --verify
docker compose run --rm ops npm run db:preflight
```

## Health Checks

| Endpoint | Purpose |
|----------|---------|
| `/api/health/live` | Process liveness (kubernetes livenessProbe) |
| `/api/health/ready` | Database readiness (kubernetes readinessProbe) |

## Backup & Recovery

```bash
# Backup support database
mongodump --uri="mongodb://user:pass@host:27017/?replicaSet=rs0" --db=support_library --out=/backups/$(date +%F)

# Restore
mongorestore --uri="mongodb://user:pass@host:27017/?replicaSet=rs0" --db=support_library /backups/2026-01-15/support_library
```

## Monitoring

- Health endpoints: `/api/health/live`, `/api/health/ready`
- Logs: `docker compose logs -f support-library`
- Metrics: Traefik dashboard (if using Traefik)

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `MONGODB_URI` connection timeout | Check replica set status, network/firewall |
| `AUTH_SECRET` invalid | Regenerate with `npx auth secret` (32+ chars) |
| Google OAuth redirect mismatch | Verify exact URI in Google Console |
| Health check fails | Check MongoDB connectivity, `docker compose logs` |
| Rate limited | Check `rate-limit-buckets` collection, adjust limits |

## Security Checklist

- [ ] MongoDB: Auth enabled, TLS, replica set
- [ ] Network: VPC/firewall restricts MongoDB to app servers only
- [ ] Secrets: `AUTH_SECRET`, OAuth secrets, DB passwords, and selected storage-backend credentials in secure vault
- [ ] TLS: Traefik/Let's Encrypt or custom certs
- [ ] Rate limits: Traefik middleware + app-level limits
- [ ] Updates: Watch GitHub releases for security patches

## Uploaded image attachments

Images are the only supported attachment type. The Server Action body limit (`experimental.serverActions.bodySizeLimit`) is derived from `MAX_UPLOADS_PER_ITEM` and `MAX_UPLOAD_BYTES` at **build** time in `next.config.mjs`, so change those values and rebuild before deploying.

Backends, chosen by `UPLOAD_STORAGE` (unset -> `disabled` in production, `memory` in dev):
- `r2` (Cloudflare R2): needs `R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` (optional `R2_ENDPOINT`). Requires a payment method on the Cloudflare account.
- `cloudinary` (free plan needs no card): needs `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`. Assets use the `authenticated` delivery type and are retrieved only through the authorized app proxy. Free accounts accept images up to 10 MiB and 25 MP; the app's defaults are 5 MiB and 25 MP. A paid plan with a larger file limit may explicitly set `CLOUDINARY_ALLOW_FILE_SIZE_OVER_10_MIB=true` together with its larger `MAX_UPLOAD_BYTES`.
- `memory`: in-process, lost on restart, rejected in production unless `UPLOAD_STORAGE_ALLOW_EPHEMERAL=true` (E2E/preview only).
- `disabled` (default in production): uploads are turned off.

The store stays private; downloads go through `/api/attachments/<id>` with the session's cookies. Switching backends on an existing deployment leaves previously stored objects unreachable (their keys are backend-specific), so migrate or accept the loss. `validateEnv` aborts startup when a selected backend's credentials are missing or its Cloudinary file-size configuration conflicts with the free-plan limit.
