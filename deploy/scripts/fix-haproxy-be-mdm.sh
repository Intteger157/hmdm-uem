#!/usr/bin/env bash
# Point HAProxy be_mdm at Docker gateway (127.0.0.1:8080 HTTP), not legacy Tomcat :8443 SSL.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
HAPROXY_CFG="${HAPROXY_CFG:-/etc/haproxy/haproxy.cfg}"
RC_LIB="${RC_LIB:-${HOME}/h-mdm-remote-control/scripts/single-port/lib.sh}"
RC_CONFIG="${RC_CONFIG:-${HOME}/h-mdm-remote-control/scripts/single-port/config.env}"

log() { printf '[fix-haproxy-be-mdm] %s\n' "$*"; }
die() { printf '[fix-haproxy-be-mdm] ERROR: %s\n' "$*" >&2; exit 1; }

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  die "Run as root: sudo $0"
fi

if [[ ! -f "$HAPROXY_CFG" ]]; then
  die "Missing ${HAPROXY_CFG}"
fi

if ! grep -q 'backend be_mdm' "$HAPROXY_CFG"; then
  die "No backend be_mdm in ${HAPROXY_CFG}"
fi

ensure_config_env() {
  if [[ ! -f "$RC_CONFIG" ]]; then
    log "WARNING: ${RC_CONFIG} not found — using sed fallback only."
    return 1
  fi

  if grep -q '^MDM_USE_GATEWAY="true"' "$RC_CONFIG" 2>/dev/null; then
    return 0
  fi

  log "Enabling MDM_USE_GATEWAY in ${RC_CONFIG}"
  if grep -q '^MDM_USE_GATEWAY=' "$RC_CONFIG"; then
    sed -i 's/^MDM_USE_GATEWAY=.*/MDM_USE_GATEWAY="true"/' "$RC_CONFIG"
  else
    printf '\nMDM_USE_GATEWAY="true"\nMDM_GATEWAY_PORT="8080"\n' >> "$RC_CONFIG"
  fi

  if ! grep -q '^MDM_GATEWAY_PORT=' "$RC_CONFIG"; then
    echo 'MDM_GATEWAY_PORT="8080"' >> "$RC_CONFIG"
  fi
  return 0
}

if ensure_config_env && [[ -f "$RC_LIB" ]]; then
  # shellcheck source=/dev/null
  source "$RC_LIB"
  load_config "$(dirname "$RC_LIB")"
  patch_mdm_gateway_backend
else
  if grep -q '127.0.0.1:8080' "$HAPROXY_CFG" && ! grep -q '127.0.0.1:8443' "$HAPROXY_CFG"; then
    log "be_mdm already points to 127.0.0.1:8080 — nothing to do."
    exit 0
  fi

  BACKUP="${HAPROXY_CFG}.bak.$(date +%Y%m%d-%H%M%S)"
  cp "$HAPROXY_CFG" "$BACKUP"
  log "Backup: ${BACKUP}"

  sed -i \
    -e 's|127\.0\.0\.1:8443 ssl verify none sni str([^)]*) alpn h2,http/1.1|127.0.0.1:8080|g' \
    -e 's|127\.0\.0\.1:8443 ssl verify none[^ ]*|127.0.0.1:8080|g' \
    -e 's|127\.0\.0\.1:8443|127.0.0.1:8080|g' \
    "$HAPROXY_CFG"

  if ! grep -A8 '^backend be_mdm' "$HAPROXY_CFG" | grep -q 'option forwardfor'; then
    sed -i '/^backend be_mdm/a\    option forwardfor' "$HAPROXY_CFG"
  fi
  sed -i 's/timeout http-request 60s/timeout http-request 1h/' "$HAPROXY_CFG"
fi

if grep -q '127.0.0.1:8443' "$HAPROXY_CFG"; then
  die "Still found :8443 in ${HAPROXY_CFG}. Edit backend be_mdm manually."
fi

log "New server line:"
grep 'server mdm' "$HAPROXY_CFG" || true

haproxy -c -f "$HAPROXY_CFG"
systemctl reload haproxy

log "Reloaded HAProxy."
log "Verify: curl -I https://mdm.intermark.global/login"
