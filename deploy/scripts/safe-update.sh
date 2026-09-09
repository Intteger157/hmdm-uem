#!/usr/bin/env bash
# Safe production update: pull code without losing local nginx/.env, then rebuild UI stack.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DEPLOY_DIR="${ROOT_DIR}/deploy"
ENV_FILE="${DEPLOY_DIR}/.env"
LOCAL_OVERRIDE="${DEPLOY_DIR}/nginx/local.override.conf"
LOCAL_EXAMPLE="${DEPLOY_DIR}/nginx/local.override.conf.example"
DEFAULT_CONF="${DEPLOY_DIR}/nginx/default.conf"

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

# Production nginx tweaks belong in local.override.conf, not default.conf.
if ! git diff --quiet "$DEFAULT_CONF" 2>/dev/null; then
  log "Resetting ${DEFAULT_CONF} to git version (use ${LOCAL_OVERRIDE} for custom nginx)."
  git checkout -- "$DEFAULT_CONF"
fi

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
REMOTE="origin/${BRANCH}"

log "Fetching ${REMOTE}..."
git fetch origin

LOCAL_REV="$(git rev-parse HEAD)"
if git rev-parse --verify "${REMOTE}" >/dev/null 2>&1; then
  REMOTE_REV="$(git rev-parse "${REMOTE}")"
else
  REMOTE_REV=""
fi

if [[ -n "$REMOTE_REV" && "$LOCAL_REV" == "$REMOTE_REV" ]]; then
  log "Already up to date ($(git rev-parse --short HEAD))."
else
  if ! git diff --quiet || ! git diff --cached --quiet; then
    CHANGED="$(git diff --name-only; git diff --cached --name-only | sort -u)"
    log "Stashing other local changes before pull:"
    printf '%s\n' "$CHANGED" | sed 's/^/  /'
    git stash push -u -m "safe-update $(date -u +%Y-%m-%dT%H:%M:%SZ)" -- ${CHANGED} || true
  fi

  log "Pulling ${REMOTE}..."
  git pull --ff-only origin "${BRANCH}"
fi

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
curl -sf -o /dev/null -w '  gateway / → HTTP %{http_code}\n' "http://127.0.0.1:${GATEWAY_PORT}/" || log "  gateway / failed"
curl -sf -o /dev/null -w '  gateway /rest/public/name → HTTP %{http_code}\n' "http://127.0.0.1:${GATEWAY_PORT}/rest/public/name" || log "  /rest/public/name failed"

if grep -q '127.0.0.1:8443' /etc/haproxy/haproxy.cfg 2>/dev/null; then
  log "WARNING: HAProxy be_mdm still points to :8443 (503 from outside)."
  log "Run: sudo ${DEPLOY_DIR}/scripts/fix-haproxy-be-mdm.sh"
fi

log "Done."
