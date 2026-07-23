#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <server-url> <enrollment-token> [out-dir]"
  exit 1
fi

SERVER_URL="$1"
TOKEN="$2"
OUT_DIR="${3:-dist}"
WIX_IMAGE="${WIX_IMAGE:-ghcr.io/wixtoolset/wix:v4.0.5}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
INSTALLER_DIR="$ROOT/installer"
STAGING_DIR="$INSTALLER_DIR/staging"
OUTPUT_DIR="$INSTALLER_DIR/$OUT_DIR"

mkdir -p "$STAGING_DIR" "$OUTPUT_DIR"

echo "Building HMDMAgent.exe ..."
GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build -ldflags="-s -w" -o "$STAGING_DIR/HMDMAgent.exe" "$ROOT"

echo "Building MSI with WiX (Docker) ..."
docker run --rm \
  -v "$ROOT:/src" \
  -w /src/installer \
  "$WIX_IMAGE" \
  wix build Package.wxs \
    -d "ServerUrl=$SERVER_URL" \
    -d "EnrollmentToken=$TOKEN" \
    -d "AgentBinary=staging/HMDMAgent.exe" \
    -o "$OUT_DIR/HMDMAgent.msi"

echo "Done: $OUTPUT_DIR/HMDMAgent.msi"
