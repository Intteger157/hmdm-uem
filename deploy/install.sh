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

usage() {
  cat <<'EOF'
Usage: deploy/install.sh [options]

Linux-only backend installer. Builds the Java MDM WAR, builds the Go
server-windows image, and starts Docker Compose on the host.

Options:
  --skip-build     Do not rebuild Java WAR or Docker images
  --skip-java      Skip Maven WAR build (expects server/target/launcher.war)
  --skip-docker    Build artifacts only, do not start containers
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

mkdir -p "${WEBAPPS_DIR}" "${DEPLOY_DIR}/volumes/work" "${DEPLOY_DIR}/volumes/hmdm-config" "${DEPLOY_DIR}/volumes/db"

ensure_build_properties() {
  local docker_template="${ROOT_DIR}/server/build.properties.docker"

  if [[ ! -f "${docker_template}" ]]; then
    die "Missing ${docker_template}. Run git pull to update the repository."
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

WINDOWS_PORT="$(grep '^SERVER_WINDOWS_PORT=' "${ENV_FILE}" | cut -d= -f2-)"
WINDOWS_PORT="${WINDOWS_PORT:-8082}"

cat <<EOF

Backend stack is up.

Unified gateway (Java + Go):
  http://localhost:${GATEWAY_PORT}

Java MDM (via gateway):
  http://localhost:${GATEWAY_PORT}/

Windows agent API (via gateway):
  http://localhost:${GATEWAY_PORT}/rest/windows/enroll
  http://localhost:${GATEWAY_PORT}/rest/windows/inventory

Direct Go service (debug):
  http://localhost:${WINDOWS_PORT}/rest/windows/enroll

Useful commands:
  docker compose --env-file deploy/.env -f deploy/docker-compose.yml ps
  docker compose --env-file deploy/.env -f deploy/docker-compose.yml logs -f gateway hmdm server-windows
  docker compose --env-file deploy/.env -f deploy/docker-compose.yml down

Agent registry ServerURL example:
  http://localhost:${GATEWAY_PORT}
EOF
