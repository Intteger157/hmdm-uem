#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <server-url> [out-dir]"
  exit 1
fi

SERVER_URL="$1"
OUT_DIR="${2:-dist}"
WIX_IMAGE="${WIX_IMAGE:-hmdm-wix-builder:local}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
INSTALLER_DIR="$ROOT/installer"
STAGING_DIR="$INSTALLER_DIR/staging"
OUTPUT_DIR="$INSTALLER_DIR/$OUT_DIR"
OUTPUT_MSI="$OUTPUT_DIR/HMDMAgent.msi"

mkdir -p "$STAGING_DIR" "$OUTPUT_DIR"

echo "Building HMDMAgent.exe ..."
GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build -ldflags="-s -w" -o "$STAGING_DIR/HMDMAgent.exe" "$ROOT"

run_wix_build() {
  wix build Package.wxs \
    -d "ServerUrl=$SERVER_URL" \
    -d "AgentBinary=staging/HMDMAgent.exe" \
    -o "$OUT_DIR/HMDMAgent.msi"
}

built=0
cd "$INSTALLER_DIR"

if command -v wix >/dev/null 2>&1; then
  echo "Building universal MSI with local WiX ..."
  if run_wix_build; then
    built=1
  fi
fi

if [[ "$built" -eq 0 ]] && command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  echo "Building universal MSI with WiX (Docker) ..."
  docker build -f Dockerfile.wix -t "$WIX_IMAGE" "$INSTALLER_DIR"
  docker run --rm \
    -v "$ROOT:/src" \
    -w /src/installer \
    "$WIX_IMAGE" \
    build Package.wxs \
      -d "ServerUrl=$SERVER_URL" \
      -d "AgentBinary=staging/HMDMAgent.exe" \
      -o "$OUT_DIR/HMDMAgent.msi"
  built=1
fi

if [[ "$built" -eq 0 ]]; then
  echo "MSI build failed. Install WiX (dotnet tool install --global wix) or start Docker." >&2
  exit 1
fi

if [[ ! -f "$OUTPUT_MSI" ]]; then
  echo "MSI was not created: $OUTPUT_MSI" >&2
  exit 1
fi

echo "Done: $OUTPUT_MSI"
