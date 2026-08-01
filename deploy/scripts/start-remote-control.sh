#!/usr/bin/env bash
# Start or restart the Headwind Remote docker stack (Janus + nginx web-admin).
set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROOT_DIR="$(cd "${DEPLOY_DIR}/.." && pwd)"
REMOTE_REPO="${ROOT_DIR}/plugins/deviceremote/h-mdm-remote-control"
COMPOSE_FILE="${REMOTE_REPO}/docker-compose.yaml"

if [[ ! -f "${COMPOSE_FILE}" ]]; then
  echo "[start-remote] ERROR: ${COMPOSE_FILE} not found. Run deploy/scripts/install-remote-control.sh first." >&2
  exit 1
fi

echo "[start-remote] Starting Headwind Remote from ${COMPOSE_FILE}"
(
  cd "${REMOTE_REPO}"
  docker compose up -d
)

echo "[start-remote] Done. Check: docker compose -f ${COMPOSE_FILE} ps"
