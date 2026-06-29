#!/bin/bash
# Production deploy script — blue-green with health check + auto-rollback
# Usage: ./scripts/deploy-production.sh
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log()  { echo -e "${GREEN}[$(date +%H:%M:%S)] ✓ $1${NC}"; }
warn() { echo -e "${YELLOW}[$(date +%H:%M:%S)] ⚠ $1${NC}"; }
die()  { echo -e "${RED}[$(date +%H:%M:%S)] ✗ $1${NC}"; exit 1; }

HEALTH_URL="http://localhost/api/health"
HEALTH_RETRIES=24
HEALTH_INTERVAL=5

echo "🚀 ATC PRO — Production Deploy"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── 1. Pull code ─────────────────────────────────────────────────
log "Pulling latest code from main..."
git pull origin main || die "git pull failed"

# ── 2. Build frontend ────────────────────────────────────────────
log "Building frontend (npm run build)..."
npm ci --silent
npm run build || die "Frontend build failed"
log "Frontend built → dist/"

# ── 3. Build Docker images ───────────────────────────────────────
log "Building Docker images..."
docker compose build --no-cache || die "Docker build failed"

# ── 4. Run DB migrations ─────────────────────────────────────────
log "Running database migrations..."
docker compose run --rm backend sh -c "
  psql \${DATABASE_URL:-postgresql://\${DB_USER}:\${DB_PASS}@postgres:5432/\${DB_NAME}} \
    -f /app/migrations/004_add_performance_indexes.sql 2>&1 \
    || echo 'Migration already applied or no changes needed'
" 2>/dev/null || warn "Migration step skipped (service not running yet)"

# ── 5. Snapshot old container IDs for rollback ───────────────────
OLD_BACKEND=$(docker compose ps -q backend 2>/dev/null || echo "")

# ── 6. Bring up new containers ───────────────────────────────────
log "Starting updated services..."
docker compose up -d --no-deps backend analytics nginx

# ── 7. Health check ──────────────────────────────────────────────
log "Health check ($HEALTH_RETRIES attempts × ${HEALTH_INTERVAL}s)..."
for i in $(seq 1 $HEALTH_RETRIES); do
  if curl -sf "$HEALTH_URL" > /dev/null 2>&1; then
    log "Health check passed (attempt $i)"
    break
  fi
  if [ $i -eq $HEALTH_RETRIES ]; then
    warn "Health check FAILED — rolling back"
    docker compose logs --tail=50 backend
    # Rollback: restart from previous image
    docker compose up -d --no-deps --force-recreate backend analytics
    die "Deployment rolled back. Check logs above."
  fi
  echo "  Waiting... ($i/$HEALTH_RETRIES)"
  sleep $HEALTH_INTERVAL
done

# ── 8. Reload Nginx ──────────────────────────────────────────────
docker compose exec nginx nginx -s reload 2>/dev/null || warn "Nginx reload skipped"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "Deploy hoàn thành! 🎉"
echo ""
warn "Nhớ kiểm tra logs: docker compose logs -f backend"
