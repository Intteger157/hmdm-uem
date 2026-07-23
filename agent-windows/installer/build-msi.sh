#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <server-url> <enrollment-token> [out-dir]"
  exit 1
fi

SERVER_URL="$1"
TOKEN="$2"
OUT_DIR="${3:-dist}"
WIX_IMAGE="${WIX_IMAGE:-hmdm-wix-builder:local}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
INSTALLER_DIR="$ROOT/installer"
STAGING_DIR="$INSTALLER_DIR/staging"
OUTPUT_DIR="$INSTALLER_DIR/$OUT_DIR"
OUTPUT_MSI="$OUTPUT_DIR/HMDMAgent.msi"

mkdir -p "$STAGING_DIR" "$OUTPUT_DIR"

echo "Building HMDMAgent.exe ..."
GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build -ldflags="-s -w" -o "$STAGING_DIR/HMDMAgent.exe" "$ROOT"

cd "$INSTALLER_DIR"

if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  echo "Building MSI with WiX in Docker ..."
  docker build -f Dockerfile.wix -t "$WIX_IMAGE" "$INSTALLER_DIR"
  docker run --rm \
    -v "$ROOT:/src" \
    -w /src/installer \
    "$WIX_IMAGE" \
    build Package.wxs \
      -arch x64 \
      -d "ServerUrl=$SERVER_URL" \
      -d "EnrollmentToken=$TOKEN" \
      -d "AgentBinary=staging/HMDMAgent.exe" \
      -o "$OUT_DIR/HMDMAgent.msi"
elif command -v wix >/dev/null 2>&1; then
  echo "Building MSI with local WiX ..."
  wix build Package.wxs \
    -arch x64 \
    -d "ServerUrl=$SERVER_URL" \
    -d "EnrollmentToken=$TOKEN" \
    -d "AgentBinary=staging/HMDMAgent.exe" \
    -o "$OUT_DIR/HMDMAgent.msi"
else
  echo "Start Docker Desktop or install WiX (dotnet tool install --global wix)." >&2
  exit 1
fi

if [[ ! -f "$OUTPUT_MSI" ]]; then
  echo "MSI was not created: $OUTPUT_MSI" >&2
  exit 1
fi

echo "Done: $OUTPUT_MSI"
