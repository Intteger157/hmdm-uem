#!/usr/bin/env bash
# Safe production update: pull code without losing local nginx/.env, then rebuild UI stack.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DEPLOY_DIR="${ROOT_DIR}/deploy"
ENV_FILE="${DEPLOY_DIR}/.env"
LOCAL_OVERRIDE="${DEPLOY_DIR}/nginx/local.override.conf"
LOCAL_EXAMPLE="${DEPLOY_DIR}/nginx/local.override.conf.example"

log() { printf '[safe-update] %s\n' "$*"; }
die() { printf '[safe-update] ERROR: %s\n' "$*" >&2; exit 1; }

cd "$ROOT_DIR"

if [[ ! -f "$ENV_FILE" ]]; then
  die "Missing ${ENV_FILE}. Copy from deploy/.env.example first."
fi

if [[ ! -f "$LOCAL_OVERRIDE" ]]; then
  if [[ -f "$LOCAL_EXAMPLE" ]]; then
    cp "$LOCAL_EXAMPLE" "$LOCAL_OVERRIDE"
    log "Created ${LOCAL_OVERRIDE} from example (gitignored)."
  else
    touch "$LOCAL_OVERRIDE"
    log "Created empty ${LOCAL_OVERRIDE} (gitignored)."
  fi
fi

# Tell git to keep server-side edits to these paths during pull.
for path in deploy/nginx/local.override.conf deploy/.env; do
  if git rev-parse --is-inside-work-tree >/dev/null 2>&1 && [[ -e "$path" ]]; then
    git update-index --skip-worktree "$path" 2>/dev/null || true
  fi
done

if git diff --quiet deploy/nginx/default.conf 2>/dev/null; then
  :
else
  log "WARNING: deploy/nginx/default.conf has local edits."
  log "Move them to deploy/nginx/local.override.conf, then:"
  log "  git checkout -- deploy/nginx/default.conf"
fi

log "Pulling latest code..."
git pull --rebase

COMPOSE=(docker compose --env-file "$ENV_FILE" -f "${DEPLOY_DIR}/docker-compose.yml")
if [[ -f "${DEPLOY_DIR}/docker-compose.haproxy-host.yml" ]] && grep -q 'be_mdm' /etc/haproxy/haproxy.cfg 2>/dev/null; then
  COMPOSE+=(-f "${DEPLOY_DIR}/docker-compose.haproxy-host.yml")
  log "Using docker-compose.haproxy-host.yml overlay."
fi

log "Recreating gateway + frontend-v2..."
"${COMPOSE[@]}" up -d --build frontend-v2 gateway

GATEWAY_PORT="$(grep '^GATEWAY_PORT=' "$ENV_FILE" | cut -d= -f2-)"
GATEWAY_PORT="${GATEWAY_PORT:-8080}"

log "Container status:"
"${COMPOSE[@]}" ps gateway hmdm frontend-v2 server-windows

log "Health checks:"
curl -sf -o /dev/null -w '  gateway / → HTTP %{http_code}\n' "http://127.0.0.1:${GATEWAY_PORT:-8080}/" || log "  gateway / failed"
curl -sf -o /dev/null -w '  gateway /rest/public/name → HTTP %{http_code}\n' "http://127.0.0.1:${GATEWAY_PORT:-8080}/rest/public/name" || log "  /rest/public/name failed"

log "Done. If HAProxy still returns 503, check: grep 'server mdm' /etc/haproxy/haproxy.cfg"
