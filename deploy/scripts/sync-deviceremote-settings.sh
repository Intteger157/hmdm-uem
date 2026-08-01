#!/usr/bin/env bash
# Upsert aPuppet / Headwind Remote plugin settings in PostgreSQL from deploy/.env.
#
# The Java deviceremote plugin reads serverUrl and serverSecret from
# plugin_deviceremote_settings — not from Tomcat env vars.
set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${DEPLOY_DIR}/.env"
COMPOSE_FILE="${DEPLOY_DIR}/docker-compose.yml"
ROOT_DIR="$(cd "${DEPLOY_DIR}/.." && pwd)"
REMOTE_REPO="${ROOT_DIR}/plugins/deviceremote/h-mdm-remote-control"
JANUS_SECRET_FILE="${REMOTE_REPO}/deploy/dist/credentials/janus_api_secret"

log() {
  printf '[sync-deviceremote] %s\n' "$*"
}

die() {
  printf '[sync-deviceremote] ERROR: %s\n' "$*" >&2
  exit 1
}

if [[ ! -f "${ENV_FILE}" ]]; then
  die "${ENV_FILE} not found"
fi

read_env() {
  local key="$1"
  local default="${2:-}"
  local value
  value="$(grep "^${key}=" "${ENV_FILE}" 2>/dev/null | cut -d= -f2- || true)"
  printf '%s' "${value:-$default}"
}

trim() {
  tr -d '\r' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//'
}

sql_escape() {
  printf "%s" "$1" | sed "s/'/''/g"
}

REMOTE_DOMAIN="$(read_env REMOTE_DOMAIN | trim)"
REMOTE_SERVER_URL="$(read_env REMOTE_SERVER_URL | trim)"
REMOTE_SERVER_SECRET="$(read_env REMOTE_SERVER_SECRET | trim)"
REMOTE_HTTPS_PORT="$(read_env REMOTE_HTTPS_PORT 9443 | trim)"
PUBLIC_PROTOCOL="$(read_env PUBLIC_PROTOCOL | trim)"
PROTOCOL="$(read_env PROTOCOL http | trim)"

if [[ -z "${PUBLIC_PROTOCOL}" ]]; then
  if [[ "${PROTOCOL}" == "http" && -n "${REMOTE_DOMAIN}" && "${REMOTE_DOMAIN}" != "localhost" ]]; then
    PUBLIC_PROTOCOL="https"
  else
    PUBLIC_PROTOCOL="${PROTOCOL}"
  fi
fi

if [[ -z "${REMOTE_SERVER_URL}" && -n "${REMOTE_DOMAIN}" ]]; then
  if [[ "${PUBLIC_PROTOCOL}" == "https" && "${REMOTE_HTTPS_PORT}" != "443" ]]; then
    REMOTE_SERVER_URL="${PUBLIC_PROTOCOL}://${REMOTE_DOMAIN}:${REMOTE_HTTPS_PORT}/web-admin/"
  else
    REMOTE_SERVER_URL="${PUBLIC_PROTOCOL}://${REMOTE_DOMAIN}/web-admin/"
  fi
fi

if [[ -z "${REMOTE_SERVER_SECRET}" && -f "${JANUS_SECRET_FILE}" ]]; then
  REMOTE_SERVER_SECRET="$(trim < "${JANUS_SECRET_FILE}")"
  log "Using janus_api_secret from ${JANUS_SECRET_FILE}"
fi

if [[ -z "${REMOTE_SERVER_URL}" ]]; then
  log "Skipping: set REMOTE_DOMAIN or REMOTE_SERVER_URL in ${ENV_FILE}"
  exit 0
fi

if [[ -z "${REMOTE_SERVER_SECRET}" ]]; then
  die "REMOTE_SERVER_SECRET is empty and ${JANUS_SECRET_FILE} was not found. Install remote control first or set the secret in ${ENV_FILE}."
fi

SQL_USER="$(read_env SQL_USER hmdm | trim)"
SQL_BASE="$(read_env SQL_BASE hmdm | trim)"
CUSTOMER_ID="$(read_env REMOTE_CUSTOMER_ID 1 | trim)"

SERVER_URL_SQL="$(sql_escape "${REMOTE_SERVER_URL}")"
SERVER_SECRET_SQL="$(sql_escape "${REMOTE_SERVER_SECRET}")"

run_psql() {
  docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" exec -T postgresql \
    psql -v ON_ERROR_STOP=1 -U "${SQL_USER}" -d "${SQL_BASE}" "$@"
}

log "Upserting deviceremote settings for customerId=${CUSTOMER_ID}"
log "  serverUrl=${REMOTE_SERVER_URL}"

run_psql -c "
INSERT INTO plugin_deviceremote_settings (customerId, serverUrl, serverSecret)
VALUES (${CUSTOMER_ID}, '${SERVER_URL_SQL}', '${SERVER_SECRET_SQL}')
ON CONFLICT (customerId) DO UPDATE
SET serverUrl = EXCLUDED.serverUrl,
    serverSecret = EXCLUDED.serverSecret;
"

log "Done."
