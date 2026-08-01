#!/usr/bin/env bash
set -euo pipefail

GATEWAY_URL="${1:-http://127.0.0.1:${GATEWAY_PORT:-8080}}"

check_path() {
  local path="$1"
  echo "==> GET ${GATEWAY_URL}${path}"
  # Use GET (not HEAD): bootstrap routes are registered as GET only.
  headers="$(curl -fsS -D - -o /dev/null "${GATEWAY_URL}${path}")"
  echo "$headers" | head -n 5
  body="$(curl -fsS "${GATEWAY_URL}${path}" | head -n 3)"
  echo "$body"
  if ! grep -qi 'content-type: text/plain' <<<"$headers"; then
    echo "ERROR: expected text/plain for ${path}" >&2
    exit 1
  fi
  if ! grep -q 'Singularity MDM' <<<"$body"; then
    echo "ERROR: bootstrap script body missing for ${path}" >&2
    exit 1
  fi
  echo "OK: ${path}"
  echo
}

# Primary URL used by the Enrollment page command
check_path /api/windows/enroll

# Optional alias — should also work after gateway + server-windows redeploy
if curl -fsS -D - -o /dev/null "${GATEWAY_URL}/rest/windows/enroll" >/dev/null 2>&1; then
  check_path /rest/windows/enroll
else
  echo "WARN: /rest/windows/enroll unavailable (optional alias). Primary /api/windows/enroll is OK."
  echo
fi

echo "Bootstrap enroll endpoint is reachable through the gateway."
