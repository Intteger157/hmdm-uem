#!/usr/bin/env bash
# Install Headwind Remote (aPuppet server) from the git submodule and wire MDM settings.
#
# Janus WebRTC needs host networking (UDP RTP 10000-10500), so this stack runs on
# the Linux host beside deploy/docker-compose.yml — not inside the MDM compose network.
set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${DEPLOY_DIR}/.env"
ROOT_DIR="$(cd "${DEPLOY_DIR}/.." && pwd)"
REMOTE_REPO="${ROOT_DIR}/plugins/deviceremote/h-mdm-remote-control"
CONFIG_TEMPLATE="${DEPLOY_DIR}/remote-control.config.yaml.example"

log() {
  printf '[install-remote] %s\n' "$*"
}

die() {
  printf '[install-remote] ERROR: %s\n' "$*" >&2
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Missing required command: $1"
}

if [[ "$(uname -s 2>/dev/null || true)" != "Linux" ]]; then
  die "Remote control install supports Linux hosts only (Janus host networking + UDP)."
fi

if [[ ! -f "${ENV_FILE}" ]]; then
  die "${ENV_FILE} not found — copy deploy/.env.example first"
fi

# shellcheck source=lib/env.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib/env.sh"

REMOTE_DOMAIN="$(read_env REMOTE_DOMAIN)"
REMOTE_CERTBOT_EMAIL="$(read_env REMOTE_CERTBOT_EMAIL)"
REMOTE_PUBLIC_IP="$(read_env REMOTE_PUBLIC_IP)"
REMOTE_NAT="$(read_env REMOTE_NAT true)"
REMOTE_HTTPS_PORT="$(read_env REMOTE_HTTPS_PORT 9443)"
REMOTE_HTTP_LISTEN="$(read_env REMOTE_HTTP_LISTEN '127.0.0.1:8081')"
BASE_DOMAIN="$(read_env BASE_DOMAIN)"

raw_remote_domain_line="$(grep "^REMOTE_DOMAIN=" "${ENV_FILE}" 2>/dev/null | head -n1 | cut -d= -f2- || true)"
if [[ "${raw_remote_domain_line}" == *"#"* ]]; then
  die "REMOTE_DOMAIN in ${ENV_FILE} has an inline comment on the same line. Use:
  # DNS A-запись на VPS
  REMOTE_DOMAIN=remote-dev-mdm.intteger.uk
Current line value: ${raw_remote_domain_line}"
fi

if [[ -z "${REMOTE_DOMAIN}" ]]; then
  die "Set REMOTE_DOMAIN in ${ENV_FILE} (e.g. remote.example.com)"
fi

if [[ ! "${REMOTE_DOMAIN}" =~ ^[A-Za-z0-9.-]+$ ]]; then
  die "REMOTE_DOMAIN must be a hostname only (no spaces or inline comments in .env): got '${REMOTE_DOMAIN}'"
fi

if [[ -z "${REMOTE_CERTBOT_EMAIL}" ]]; then
  REMOTE_CERTBOT_EMAIL="$(read_env ADMIN_EMAIL)"
fi

if [[ -z "${REMOTE_CERTBOT_EMAIL}" ]]; then
  die "Set REMOTE_CERTBOT_EMAIL or ADMIN_EMAIL in ${ENV_FILE}"
fi

if [[ "${REMOTE_CERTBOT_EMAIL}" != *@* ]]; then
  die "REMOTE_CERTBOT_EMAIL must be an email address, not a domain: got '${REMOTE_CERTBOT_EMAIL}'"
fi

if [[ ! -d "${REMOTE_REPO}/deploy" ]]; then
  die "Missing ${REMOTE_REPO}. Run: git submodule update --init plugins/deviceremote/h-mdm-remote-control"
fi

require_cmd docker
require_cmd sudo

log "Writing ${REMOTE_REPO}/config.yaml"
log "  hostname=${REMOTE_DOMAIN}"
log "  email=${REMOTE_CERTBOT_EMAIL}"
log "  web_https_port=${REMOTE_HTTPS_PORT}"
log "  web_http_listen=${REMOTE_HTTP_LISTEN}"
cat > "${REMOTE_REPO}/config.yaml" <<EOF
---
hostname: "${REMOTE_DOMAIN}"
email: "${REMOTE_CERTBOT_EMAIL}"
web_https_port: ${REMOTE_HTTPS_PORT}
web_http_listen: "${REMOTE_HTTP_LISTEN}"
nat: ${REMOTE_NAT}
public_ip: "${REMOTE_PUBLIC_IP}"
is_certbot_enabled: true
is_nginx_enabled: true
EOF

log "Installing Headwind Remote (Ansible — may take several minutes) ..."
(
  cd "${REMOTE_REPO}"
  sudo ./install.sh
)

SECRET_FILE="${REMOTE_REPO}/deploy/dist/credentials/janus_api_secret"
if [[ -f "${SECRET_FILE}" ]]; then
  SECRET="$(read_env REMOTE_SERVER_SECRET)"
  if [[ -z "${SECRET}" ]]; then
    SECRET="$(cat "${SECRET_FILE}" | env_trim)"
  fi
  log "Janus API secret: ${SECRET_FILE}"
  if ! grep -q '^REMOTE_SERVER_SECRET=.' "${ENV_FILE}"; then
    if grep -q '^REMOTE_SERVER_SECRET=' "${ENV_FILE}"; then
      sed -i "s|^REMOTE_SERVER_SECRET=.*|REMOTE_SERVER_SECRET=${SECRET}|" "${ENV_FILE}"
    else
      printf '\nREMOTE_SERVER_SECRET=%s\n' "${SECRET}" >> "${ENV_FILE}"
    fi
    log "Saved REMOTE_SERVER_SECRET to ${ENV_FILE}"
  fi
fi

if [[ -n "${BASE_DOMAIN}" ]]; then
  SINGLE_PORT_DIR="${REMOTE_REPO}/scripts/single-port"
  if [[ -f "${SINGLE_PORT_DIR}/config.env.example" && ! -f "${SINGLE_PORT_DIR}/config.env" ]]; then
    log ""
    log "Optional: co-host MDM + Remote on one public :443 with HAProxy:"
    log "  cp ${SINGLE_PORT_DIR}/config.env.example ${SINGLE_PORT_DIR}/config.env"
    log "  # set REMOTE_DOMAIN=${REMOTE_DOMAIN} and MDM_DOMAIN=${BASE_DOMAIN}"
    log "  sudo ${SINGLE_PORT_DIR}/setup-single-port.sh"
  fi
fi

SYNC_SCRIPT="${DEPLOY_DIR}/scripts/sync-deviceremote-settings.sh"
if [[ -f "${SYNC_SCRIPT}" ]]; then
  log "Syncing plugin_deviceremote_settings in PostgreSQL ..."
  bash "${SYNC_SCRIPT}"
fi

cat <<EOF

Remote control server is installed.

Viewer URL (after TLS):
  https://${REMOTE_DOMAIN}$( [[ "${REMOTE_HTTPS_PORT}" != "443" ]] && printf ':%s' "${REMOTE_HTTPS_PORT}" )/web-admin/

Start / restart remote containers:
  ${DEPLOY_DIR}/scripts/start-remote-control.sh

Open firewall:
  ${REMOTE_HTTPS_PORT:-443}/tcp (web-admin)
  8089/tcp, 8989/tcp (Janus REST / WSS)
  10000-10500/udp (WebRTC media)

MDM console: Plugins → Remote control (settings should match ${ENV_FILE}).
Android device: custom launcher + com.hmdm.control APK with the same secret.
EOF
