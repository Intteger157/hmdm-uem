#!/usr/bin/env bash
set -euo pipefail

GATEWAY_URL="${1:-http://127.0.0.1:${GATEWAY_PORT:-8080}}"

for path in /rest/windows/enroll /api/windows/enroll; do
  echo "==> GET ${GATEWAY_URL}${path}"
  headers="$(curl -fsSI "${GATEWAY_URL}${path}")"
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
done

echo "Bootstrap enroll endpoints are reachable through the gateway."
