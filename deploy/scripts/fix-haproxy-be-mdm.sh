#!/usr/bin/env bash
# Point HAProxy be_mdm at Docker gateway (127.0.0.1:8080 HTTP), not legacy Tomcat :8443 SSL.
set -euo pipefail

HAPROXY_CFG="${HAPROXY_CFG:-/etc/haproxy/haproxy.cfg}"

log() { printf '[fix-haproxy-be-mdm] %s\n' "$*"; }
die() { printf '[fix-haproxy-be-mdm] ERROR: %s\n' "$*" >&2; exit 1; }

if [[ ! -f "$HAPROXY_CFG" ]]; then
  die "Missing ${HAPROXY_CFG}"
fi

if ! grep -q 'backend be_mdm' "$HAPROXY_CFG"; then
  die "No backend be_mdm in ${HAPROXY_CFG}"
fi

if grep -q '127.0.0.1:8080' "$HAPROXY_CFG" && ! grep -q '127.0.0.1:8443' "$HAPROXY_CFG"; then
  log "be_mdm already points to 127.0.0.1:8080 — nothing to do."
  exit 0
fi

BACKUP="${HAPROXY_CFG}.bak.$(date +%Y%m%d-%H%M%S)"
cp "$HAPROXY_CFG" "$BACKUP"
log "Backup: ${BACKUP}"

# Replace legacy Tomcat SSL upstream with HTTP gateway.
sed -i \
  -e 's|127\.0\.0\.1:8443 ssl verify none sni str([^)]*) alpn h2,http/1.1|127.0.0.1:8080|g' \
  -e 's|127\.0\.0\.1:8443 ssl verify none[^ ]*|127.0.0.1:8080|g' \
  -e 's|127\.0\.0\.1:8443|127.0.0.1:8080|g' \
  "$HAPROXY_CFG"

if grep -q '127.0.0.1:8443' "$HAPROXY_CFG"; then
  die "Still found :8443 in ${HAPROXY_CFG}. Edit backend be_mdm manually (see deploy/PRODUCTION-MIGRATION-HAPROXY.md Step 7)."
fi

if ! grep -q 'option forwardfor' "$HAPROXY_CFG"; then
  log "WARNING: option forwardfor not found — device public IPs may show Docker addresses."
fi

log "New server line:"
grep 'server mdm' "$HAPROXY_CFG" || true

haproxy -c -f "$HAPROXY_CFG"
systemctl reload haproxy

log "Reloaded HAProxy. Test:"
log "  curl -I https://mdm.intermark.global/"
log "  curl -I http://127.0.0.1:8080/"

# Prevent cert-renew cron from rewriting be_mdm back to :8443 (remote-control stack).
RC_CONFIG="${HOME}/h-mdm-remote-control/scripts/single-port/config.env"
if [[ -f "$RC_CONFIG" ]]; then
  if ! grep -q 'MDM_USE_GATEWAY="true"' "$RC_CONFIG" 2>/dev/null; then
    log "TIP: set MDM_USE_GATEWAY=\"true\" and MDM_GATEWAY_PORT=\"8080\" in ${RC_CONFIG}"
    log "     so weekly cert renew does not reset be_mdm to :8443."
  fi
fi
