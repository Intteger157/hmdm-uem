#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <server-url> <enrollment-token> [out-dir]"
  exit 1
fi

SERVER_URL="$1"
TOKEN="$2"
OUT_DIR="${3:-dist}"
WIX_IMAGE="${WIX_IMAGE:-singularity-mdm-wix-builder:local}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
INSTALLER_DIR="$ROOT/installer"
STAGING_DIR="$INSTALLER_DIR/staging"
OUTPUT_DIR="$INSTALLER_DIR/$OUT_DIR"
OUTPUT_MSI="$OUTPUT_DIR/singularity-agent.msi"

mkdir -p "$STAGING_DIR" "$OUTPUT_DIR"

echo "Building singularity-agent.exe ..."
GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build -ldflags="-s -w" -o "$STAGING_DIR/singularity-agent.exe" "$ROOT"

cd "$INSTALLER_DIR"

if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  echo "Building singularity-agent.msi with WiX in Docker ..."
  docker build -f Dockerfile.wix -t "$WIX_IMAGE" "$INSTALLER_DIR"
  docker run --rm \
    -v "$ROOT:/src" \
    -w /src/installer \
    "$WIX_IMAGE" \
    build Package.wxs \
      -arch x64 \
      -d "ServerUrl=$SERVER_URL" \
      -d "EnrollmentToken=$TOKEN" \
      -d "AgentBinary=staging/singularity-agent.exe" \
      -o "$OUT_DIR/singularity-agent.msi"
elif command -v wix >/dev/null 2>&1; then
  echo "Building singularity-agent.msi with local WiX ..."
  wix build Package.wxs \
    -arch x64 \
    -d "ServerUrl=$SERVER_URL" \
    -d "EnrollmentToken=$TOKEN" \
    -d "AgentBinary=staging/singularity-agent.exe" \
    -o "$OUT_DIR/singularity-agent.msi"
else
  echo "Start Docker Desktop or install WiX (dotnet tool install --global wix)." >&2
  exit 1
fi

if [[ ! -f "$OUTPUT_MSI" ]]; then
  echo "MSI was not created: $OUTPUT_MSI" >&2
  exit 1
fi

echo "Done: $OUTPUT_MSI"
