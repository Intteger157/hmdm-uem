#!/usr/bin/env bash
# Trust Docker gateway / HAProxy in Tomcat so device publicIp uses X-Real-IP, not 172.18.x.x.
set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${DEPLOY_DIR}/.env"
COMPOSE_FILE="${DEPLOY_DIR}/docker-compose.yml"
CONTEXT_FILE="${DEPLOY_DIR}/volumes/hmdm-config/ROOT.xml"

read_env() {
  local key="$1"
  local default="${2:-}"
  local value
  value="$(grep "^${key}=" "${ENV_FILE}" 2>/dev/null | cut -d= -f2- || true)"
  printf '%s' "${value:-$default}"
}

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "[fix-hmdm-proxy-ips] ERROR: ${ENV_FILE} not found" >&2
  exit 1
fi

compose() {
  docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" "$@"
}

resolve_gateway_container_ip() {
  local cid
  cid="$(compose ps -q gateway 2>/dev/null || true)"
  if [[ -z "${cid}" ]]; then
    return 1
  fi
  docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "${cid}" 2>/dev/null | head -1
}

PROXY_IPS="127.0.0.1,172.18.0.1,172.17.0.1"
GW_IP="$(resolve_gateway_container_ip || true)"
if [[ -n "${GW_IP}" ]]; then
  PROXY_IPS="${PROXY_IPS},${GW_IP}"
  echo "[fix-hmdm-proxy-ips] Gateway container IP: ${GW_IP}"
fi

patch_context_file() {
  local file="$1"
  if [[ ! -f "${file}" ]]; then
    echo "[fix-hmdm-proxy-ips] Context file not found: ${file}" >&2
    return 1
  fi

  local tmp
  tmp="$(mktemp)"

  # Drop commented or active proxy settings (ROOT.xml ships them inside <!-- -->).
  grep -Ev 'proxy\.(addresses|ip\.header)' "${file}" > "${tmp}"

  awk -v ips="${PROXY_IPS}" '
    /<\/Context>/ {
      print "    <Parameter name=\"proxy.addresses\" value=\"" ips "\"/>"
      print "    <Parameter name=\"proxy.ip.header\" value=\"X-Real-IP\"/>"
    }
    { print }
  ' "${tmp}" > "${file}"

  rm -f "${tmp}"

  echo "[fix-hmdm-proxy-ips] Patched ${file}"
  grep -E '<Parameter name="proxy\.(addresses|ip.header)"' "${file}" || true
}

if [[ ! -f "${CONTEXT_FILE}" ]]; then
  echo "[fix-hmdm-proxy-ips] ERROR: ${CONTEXT_FILE} not found — run after first hmdm boot" >&2
  exit 1
fi

patch_context_file "${CONTEXT_FILE}"

echo "[fix-hmdm-proxy-ips] Restarting hmdm + gateway..."
compose restart gateway hmdm

echo "[fix-hmdm-proxy-ips] Done."
echo "  Ensure HAProxy backend be_mdm has: option forwardfor"
echo "  Devices update publicIp on next sync (may take a few minutes)."
