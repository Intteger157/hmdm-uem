#!/usr/bin/env bash
# Copy jwt.secretkey from the running Java MDM container into deploy/.env JWT_SECRET.
# server-windows must use the same value or every /rest/windows admin route returns 401.
set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${DEPLOY_DIR}/.env"
COMPOSE_FILE="${DEPLOY_DIR}/docker-compose.yml"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "[sync-jwt-secret] ERROR: ${ENV_FILE} not found" >&2
  exit 1
fi

read_env() {
  local key="$1"
  grep "^${key}=" "${ENV_FILE}" | cut -d= -f2- || true
}

extract_java_secret() {
  docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" exec -T hmdm \
    sh -c 'grep "^jwt.secretkey=" /usr/local/tomcat/webapps/ROOT/WEB-INF/classes/build.properties 2>/dev/null | cut -d= -f2- || grep "name=\"jwt.secretkey\"" /usr/local/tomcat/conf/Catalina/localhost/ROOT.xml 2>/dev/null | sed -n "s/.*value=\"\\([^\"]*\\)\".*/\\1/p"' \
    | tr -d '\r' | head -n1
}

JAVA_SECRET="$(extract_java_secret)"
if [[ -z "${JAVA_SECRET}" ]]; then
  echo "[sync-jwt-secret] ERROR: could not read jwt.secretkey from hmdm container" >&2
  exit 1
fi

CURRENT_SECRET="$(read_env JWT_SECRET)"
if [[ "${CURRENT_SECRET}" == "${JAVA_SECRET}" ]]; then
  echo "[sync-jwt-secret] JWT_SECRET already matches Java jwt.secretkey"
  exit 0
fi

echo "[sync-jwt-secret] Updating JWT_SECRET in ${ENV_FILE}"
if grep -q '^JWT_SECRET=' "${ENV_FILE}"; then
  sed -i "s|^JWT_SECRET=.*|JWT_SECRET=${JAVA_SECRET}|" "${ENV_FILE}"
else
  printf '\nJWT_SECRET=%s\n' "${JAVA_SECRET}" >> "${ENV_FILE}"
fi

echo "[sync-jwt-secret] Restarting server-windows"
docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" up -d server-windows

echo "[sync-jwt-secret] Done. JWT_SECRET now matches Java jwt.secretkey."
