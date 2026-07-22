#!/usr/bin/env bash
# Rewrite stored /files/ URLs that still point at localhost or the LAN IP
# to the public base URL from deploy/.env (PROTOCOL + BASE_DOMAIN).
set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${DEPLOY_DIR}/.env"
COMPOSE_FILE="${DEPLOY_DIR}/docker-compose.yml"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "[sync-file-urls] ERROR: ${ENV_FILE} not found" >&2
  exit 1
fi

read_env() {
  local key="$1"
  local default="${2:-}"
  local value
  value="$(grep "^${key}=" "${ENV_FILE}" | cut -d= -f2- || true)"
  printf '%s' "${value:-$default}"
}

BASE_DOMAIN="$(read_env BASE_DOMAIN)"
PROTOCOL="$(read_env PROTOCOL http)"
LOCAL_IP="$(read_env LOCAL_IP)"
SQL_USER="$(read_env SQL_USER hmdm)"
SQL_BASE="$(read_env SQL_BASE hmdm)"

if [[ -z "${BASE_DOMAIN}" ]]; then
  echo "[sync-file-urls] ERROR: BASE_DOMAIN is empty in ${ENV_FILE}" >&2
  exit 1
fi

PUBLIC_BASE="${PROTOCOL}://${BASE_DOMAIN}"

echo "[sync-file-urls] Public base URL: ${PUBLIC_BASE}"

run_psql() {
  docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" exec -T postgresql \
    psql -v ON_ERROR_STOP=1 -U "${SQL_USER}" -d "${SQL_BASE}" "$@"
}

replace_prefix() {
  local column="$1"
  local old_prefix="$2"
  run_psql -c "
UPDATE \"applicationVersions\"
SET \"${column}\" = REPLACE(\"${column}\", '${old_prefix}', '${PUBLIC_BASE}')
WHERE \"${column}\" LIKE '${old_prefix}%';
"
}

for prefix in \
  "http://localhost" \
  "http://localhost:8080" \
  "https://localhost" \
  "https://localhost:8080"; do
  for column in url "urlArmeabi" "urlArm64"; do
    replace_prefix "${column}" "${prefix}" || true
  done
done

if [[ -n "${LOCAL_IP}" ]]; then
  for prefix in "http://${LOCAL_IP}" "http://${LOCAL_IP}:8080"; do
    for column in url "urlArmeabi" "urlArm64"; do
      replace_prefix "${column}" "${prefix}" || true
    done
  done
fi

echo "[sync-file-urls] Done. Sample launcher URLs:"
run_psql -c "
SELECT id, version, url
FROM \"applicationVersions\"
WHERE \"applicationId\" = 46
ORDER BY id DESC
LIMIT 5;
"
