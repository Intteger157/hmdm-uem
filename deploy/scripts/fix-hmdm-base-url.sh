#!/usr/bin/env bash
# Ensure Tomcat context base.url matches PROTOCOL + BASE_DOMAIN from deploy/.env.
# QR codes embed com.hmdm.BASE_URL from this value; wrong value => launcher hits localhost.
set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${DEPLOY_DIR}/.env"
COMPOSE_FILE="${DEPLOY_DIR}/docker-compose.yml"
CONTEXT_DIR="${DEPLOY_DIR}/volumes/hmdm-config"
CONTEXT_FILE="${CONTEXT_DIR}/ROOT.xml"

read_env() {
  local key="$1"
  local default="${2:-}"
  local value
  value="$(grep "^${key}=" "${ENV_FILE}" | cut -d= -f2- || true)"
  printf '%s' "${value:-$default}"
}

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "[fix-hmdm-base-url] ERROR: ${ENV_FILE} not found" >&2
  exit 1
fi

BASE_DOMAIN="$(read_env BASE_DOMAIN)"
PROTOCOL="$(read_env PROTOCOL https)"
PUBLIC_BASE="${PROTOCOL}://${BASE_DOMAIN}"

if [[ -z "${BASE_DOMAIN}" ]]; then
  echo "[fix-hmdm-base-url] ERROR: BASE_DOMAIN is empty in ${ENV_FILE}" >&2
  exit 1
fi

echo "[fix-hmdm-base-url] Target base.url: ${PUBLIC_BASE}"

patch_context_file() {
  local file="$1"
  if [[ ! -f "${file}" ]]; then
    echo "[fix-hmdm-base-url] Context file not found: ${file}" >&2
    return 1
  fi

  if grep -q 'name="base.url"' "${file}"; then
    sed -i "s|<Parameter name=\"base.url\" value=\"[^\"]*\"|<Parameter name=\"base.url\" value=\"${PUBLIC_BASE}\"|" "${file}"
  else
    echo "[fix-hmdm-base-url] ERROR: base.url parameter missing in ${file}" >&2
    return 1
  fi

  if grep -q "name=\"mqtt.server.uri\"" "${file}"; then
    sed -i "s|<Parameter name=\"mqtt.server.uri\" value=\"[^\"]*\"|<Parameter name=\"mqtt.server.uri\" value=\"${BASE_DOMAIN}:31000\"|" "${file}"
  fi

  echo "[fix-hmdm-base-url] Patched ${file}"
  grep -E 'name="(base.url|mqtt.server.uri)"' "${file}" || true
}

reconfigure_via_container() {
  echo "[fix-hmdm-base-url] No ROOT.xml yet — restarting hmdm with FORCE_RECONFIGURE=true"
  docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" stop hmdm
  BASE_DOMAIN="${BASE_DOMAIN}" PROTOCOL="${PROTOCOL}" LOCAL_IP="$(read_env LOCAL_IP)" \
    FORCE_RECONFIGURE=true \
    docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" up -d hmdm
}

if [[ -f "${CONTEXT_FILE}" ]]; then
  patch_context_file "${CONTEXT_FILE}"
  docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" restart hmdm
else
  reconfigure_via_container
fi

echo "[fix-hmdm-base-url] Waiting for MDM backend..."
for _ in $(seq 1 60); do
  if docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" exec -T hmdm \
    wget -q -O /dev/null http://127.0.0.1:8080/ 2>/dev/null; then
    break
  fi
  sleep 5
done

echo "[fix-hmdm-base-url] Current base.url inside container:"
docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" exec -T hmdm \
  grep 'name="base.url"' /usr/local/tomcat/conf/Catalina/localhost/ROOT.xml || true

echo "[fix-hmdm-base-url] Done. Factory-reset the phone and scan a fresh QR code."
