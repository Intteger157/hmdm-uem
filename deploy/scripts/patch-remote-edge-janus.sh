#!/usr/bin/env bash
# Patch web-admin settings.js for Layout B (TLS on edge nginx, Janus HTTP behind :9443).
#
# When REMOTE_CERTBOT_ENABLED=false, Janus runs HTTP on 127.0.0.1:8088 only.
# The browser page is HTTPS, so settings.js must use https://<host>/janus (via edge → :9443 → nginx /janus),
# not https://<host>:8089 or wss://<host>:8989.
set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${DEPLOY_DIR}/.env"
ROOT_DIR="$(cd "${DEPLOY_DIR}/.." && pwd)"
REMOTE_REPO="${ROOT_DIR}/plugins/deviceremote/h-mdm-remote-control"
SETTINGS_JS="${REMOTE_REPO}/deploy/dist/web-admin/dist/js/settings.js"

# shellcheck source=lib/env.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib/env.sh"

if [[ "$(env_bool "$(read_env REMOTE_CERTBOT_ENABLED false)")" == "true" ]]; then
  printf '[patch-remote-janus] REMOTE_CERTBOT_ENABLED=true — skip edge Janus patch\n'
  exit 0
fi

if [[ ! -f "${SETTINGS_JS}" ]]; then
  echo "[patch-remote-janus] ERROR: ${SETTINGS_JS} not found. Run install-remote-control.sh first." >&2
  exit 1
fi

python3 - "${SETTINGS_JS}" <<'PY'
import pathlib
import re
import sys

path = pathlib.Path(sys.argv[1])
text = path.read_text(encoding="utf-8")

replacement = """function getJanusServers() {
    var host = window.location.host;
    var servers = [];
    if (window.location.protocol === 'https:') {
        servers.push(`https://${host}/janus`);
    } else {
        servers.push(`http://${host}/janus`);
    }
    return servers;
}"""

pattern = r"function getJanusServers\(\)\s*\{[\s\S]*?\n\}"
if not re.search(pattern, text):
    print(f"[patch-remote-janus] ERROR: getJanusServers() not found in {path}", file=sys.stderr)
    sys.exit(1)

patched = re.sub(pattern, replacement, text, count=1)
path.write_text(patched, encoding="utf-8")
print(f"[patch-remote-janus] Patched {path} for edge TLS (/janus via nginx :9443)")
PY
