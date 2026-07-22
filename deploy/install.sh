#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPLOY_DIR="${ROOT_DIR}/deploy"
ENV_FILE="${DEPLOY_DIR}/.env"
WAR_PATH="${ROOT_DIR}/server/target/launcher.war"
WEBAPPS_DIR="${DEPLOY_DIR}/volumes/webapps"

SKIP_BUILD=0
SKIP_JAVA=0
SKIP_DOCKER=0
DEV_MODE=0

usage() {
  cat <<'EOF'
Usage: deploy/install.sh [options]

Linux-only installer. Builds the Java MDM WAR (REST backend), frontend-v2,
server-windows, and starts Docker Compose on the host.

Options:
  --skip-build     Do not rebuild Java WAR or Docker images
  --skip-java      Skip Maven WAR build (expects server/target/launcher.war)
  --skip-docker    Build artifacts only, do not start containers
  --dev            Allow BASE_DOMAIN=localhost (local dev only)
  -h, --help       Show this help

Examples:
  ./deploy/install.sh
  ./deploy/install.sh --skip-java
  ./deploy/install.sh --skip-build --skip-docker
EOF
}

log() {
  printf '[install] %s\n' "$*"
}

die() {
  printf '[install] ERROR: %s\n' "$*" >&2
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Missing required command: $1"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-build)
      SKIP_BUILD=1
      ;;
    --skip-java)
      SKIP_JAVA=1
      ;;
    --skip-docker)
      SKIP_DOCKER=1
      ;;
    --dev)
      DEV_MODE=1
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      die "Unknown option: $1"
      ;;
  esac
  shift
done

require_cmd docker

if [[ "$(uname -s 2>/dev/null || true)" != "Linux" ]]; then
  die "This installer supports Linux hosts only"
fi

if ! docker compose version >/dev/null 2>&1; then
  die "Docker Compose v2 is required (docker compose)"
fi

if [[ ! -f "${ENV_FILE}" ]]; then
  log "Creating ${ENV_FILE} from .env.example"
  cp "${DEPLOY_DIR}/.env.example" "${ENV_FILE}"
fi

ensure_env_defaults() {
  if ! grep -q '^HMDM_URL=.' "${ENV_FILE}"; then
    log "Setting HMDM_URL in ${ENV_FILE} (required by hmdm container entrypoint)"
    if grep -q '^HMDM_URL=' "${ENV_FILE}"; then
      sed -i 's|^HMDM_URL=.*|HMDM_URL=https://h-mdm.com/files/hmdm-5.39.2-os.war|' "${ENV_FILE}"
    else
      printf '\nHMDM_URL=https://h-mdm.com/files/hmdm-5.39.2-os.war\n' >> "${ENV_FILE}"
    fi
  fi

  if ! grep -q '^CLIENT_VERSION=.' "${ENV_FILE}"; then
    log "Setting CLIENT_VERSION in ${ENV_FILE}"
    if grep -q '^CLIENT_VERSION=' "${ENV_FILE}"; then
      sed -i 's|^CLIENT_VERSION=.*|CLIENT_VERSION=6.36|' "${ENV_FILE}"
    else
      printf 'CLIENT_VERSION=6.36\n' >> "${ENV_FILE}"
    fi
  fi

  if grep -q '^FORCE_RECONFIGURE=true' "${ENV_FILE}"; then
    log "Setting FORCE_RECONFIGURE=false (custom ROOT.war is deployed by install.sh)"
    sed -i 's|^FORCE_RECONFIGURE=.*|FORCE_RECONFIGURE=false|' "${ENV_FILE}"
  fi
}

read_env_value() {
  local key="$1"
  grep "^${key}=" "${ENV_FILE}" 2>/dev/null | cut -d= -f2- || true
}

validate_deploy_env() {
  local base_domain protocol

  base_domain="$(read_env_value BASE_DOMAIN)"
  protocol="$(read_env_value PROTOCOL)"
  protocol="${protocol:-http}"

  if [[ -z "${base_domain}" || "${base_domain}" == "localhost" ]]; then
    if [[ "${DEV_MODE}" -eq 0 ]]; then
      die "Set BASE_DOMAIN in ${ENV_FILE} to your public hostname BEFORE the first start (e.g. test-dev-mdm.example.com). For local dev only, re-run with --dev."
    fi
    log "Dev mode: BASE_DOMAIN=${base_domain:-localhost}"
    return 0
  fi

  if [[ "${protocol}" != "https" ]]; then
    log "WARNING: PROTOCOL=${protocol} with BASE_DOMAIN=${base_domain}. Android enrollment requires https on the public hostname."
  fi

  log "Deploy target: ${protocol}://${base_domain}"
}

is_first_database_bootstrap() {
  [[ ! -f "${DEPLOY_DIR}/volumes/db/PG_VERSION" ]]
}

validate_deploy_env_for_first_boot() {
  if is_first_database_bootstrap && [[ "${DEV_MODE}" -eq 0 ]]; then
    local base_domain
    base_domain="$(read_env_value BASE_DOMAIN)"
    if [[ -z "${base_domain}" || "${base_domain}" == "localhost" ]]; then
      die "First install: edit ${ENV_FILE} and set BASE_DOMAIN + PROTOCOL=https before starting containers."
    fi
  fi
}

ensure_env_defaults
validate_deploy_env

mkdir -p "${WEBAPPS_DIR}" "${DEPLOY_DIR}/volumes/work" "${DEPLOY_DIR}/volumes/hmdm-config" "${DEPLOY_DIR}/volumes/db"
validate_deploy_env_for_first_boot

ensure_build_properties() {
  local docker_template="${ROOT_DIR}/server/build.properties.docker"
  local pom_file="${ROOT_DIR}/server/pom.xml"

  if [[ ! -f "${docker_template}" ]]; then
    die "Missing ${docker_template}. Your checkout is outdated. Run: git stash && git pull"
  fi

  if ! grep -q 'build.properties.docker' "${pom_file}"; then
    die "server/pom.xml is outdated (expected build.properties.docker). Run: git stash && git pull"
  fi
}

GATEWAY_PORT="$(grep '^GATEWAY_PORT=' "${ENV_FILE}" | cut -d= -f2-)"
GATEWAY_PORT="${GATEWAY_PORT:-8080}"

if [[ "${SKIP_BUILD}" -eq 0 && "${SKIP_JAVA}" -eq 0 ]]; then
  ensure_build_properties
  log "Building Java backend (launcher.war) via Maven Docker image"
  docker run --rm \
    -v "${ROOT_DIR}:/usr/src/mymaven" \
    -v "${HOME}/.m2:/root/.m2" \
    -w /usr/src/mymaven \
    maven:3.9-eclipse-temurin-11 \
    mvn clean package -pl server -am -DskipTests
fi

if [[ ! -f "${WAR_PATH}" ]]; then
  die "WAR not found at ${WAR_PATH}. Run without --skip-java or build manually."
fi

log "Deploying WAR to ${WEBAPPS_DIR}/ROOT.war"
cp "${WAR_PATH}" "${WEBAPPS_DIR}/ROOT.war"
chmod 644 "${WEBAPPS_DIR}/ROOT.war"

if [[ "${SKIP_BUILD}" -eq 0 ]]; then
  log "Building Docker images"
  docker compose --env-file "${ENV_FILE}" -f "${DEPLOY_DIR}/docker-compose.yml" build
fi

if [[ "${SKIP_DOCKER}" -eq 1 ]]; then
  log "Skipping container startup (--skip-docker)"
  exit 0
fi

log "Starting backend stack"
docker compose --env-file "${ENV_FILE}" -f "${DEPLOY_DIR}/docker-compose.yml" up -d

log "Waiting for PostgreSQL"
for _ in $(seq 1 30); do
  if docker compose --env-file "${ENV_FILE}" -f "${DEPLOY_DIR}/docker-compose.yml" exec -T postgresql pg_isready -U "$(grep '^SQL_USER=' "${ENV_FILE}" | cut -d= -f2-)" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

log "Waiting for MDM backend (launcher APK URLs are written on first boot)"
for _ in $(seq 1 60); do
  if docker compose --env-file "${ENV_FILE}" -f "${DEPLOY_DIR}/docker-compose.yml" exec -T hmdm \
    wget -q -O /dev/null http://127.0.0.1:8080/ 2>/dev/null; then
    break
  fi
  sleep 5
done

SYNC_SCRIPT="${DEPLOY_DIR}/scripts/sync-file-urls.sh"
if [[ -f "${SYNC_SCRIPT}" ]]; then
  log "Syncing stored /files/ URLs to public BASE_DOMAIN"
  bash "${SYNC_SCRIPT}"
fi

FIX_BASE_URL_SCRIPT="${DEPLOY_DIR}/scripts/fix-hmdm-base-url.sh"
if [[ -f "${FIX_BASE_URL_SCRIPT}" ]]; then
  log "Ensuring Tomcat base.url matches deploy/.env (QR com.hmdm.BASE_URL)"
  bash "${FIX_BASE_URL_SCRIPT}"
fi

WINDOWS_PORT="$(grep '^SERVER_WINDOWS_PORT=' "${ENV_FILE}" | cut -d= -f2-)"
WINDOWS_PORT="${WINDOWS_PORT:-8082}"

cat <<EOF

Stack is up.

MDM console (new UI):
  http://localhost:${GATEWAY_PORT}/

Java REST API (via gateway, no legacy UI):
  http://localhost:${GATEWAY_PORT}/rest/

Windows agent API (via gateway):
  http://localhost:${GATEWAY_PORT}/rest/windows/enroll
  http://localhost:${GATEWAY_PORT}/rest/windows/inventory

Direct Go service (debug):
  http://localhost:${WINDOWS_PORT}/rest/windows/enroll

Useful commands:
  docker compose --env-file deploy/.env -f deploy/docker-compose.yml ps
  docker compose --env-file deploy/.env -f deploy/docker-compose.yml logs -f gateway frontend-v2 hmdm server-windows
  docker compose --env-file deploy/.env -f deploy/docker-compose.yml up -d --build frontend-v2 gateway
  docker compose --env-file deploy/.env -f deploy/docker-compose.yml down

Agent registry ServerURL example:
  http://localhost:${GATEWAY_PORT}
EOF
