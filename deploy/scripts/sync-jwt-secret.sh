#!/usr/bin/env bash
# Keep JWT_SECRET (Go server-windows) aligned with Java jwt.secretkey in Tomcat ROOT.xml.
#
# Java reads jwt.secretkey only from ROOT.xml (ServletContext init parameter). The value
# inside ROOT.war build.properties is not used at runtime. If ROOT.xml has no
# jwt.secretkey, TokenProvider generates a random secret on each JVM start and Go
# will always reject console JWTs with "signature is invalid".
set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${DEPLOY_DIR}/.env"
COMPOSE_FILE="${DEPLOY_DIR}/docker-compose.yml"
ROOT_DIR="$(cd "${DEPLOY_DIR}/.." && pwd)"
CONTEXT_FILE="${DEPLOY_DIR}/volumes/hmdm-config/ROOT.xml"
WEBAPPS_WAR="${DEPLOY_DIR}/volumes/webapps/ROOT.war"
REPO_DEFAULT_SECRET="${ROOT_DIR}/server/build.properties.docker"

log() {
  printf '[sync-jwt-secret] %s\n' "$*"
}

die() {
  printf '[sync-jwt-secret] ERROR: %s\n' "$*" >&2
  exit 1
}

if [[ ! -f "${ENV_FILE}" ]]; then
  die "${ENV_FILE} not found"
fi

read_env() {
  local key="$1"
  grep "^${key}=" "${ENV_FILE}" 2>/dev/null | cut -d= -f2- || true
}

trim() {
  tr -d '\r' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//'
}

# Active (uncommented) jwt.secretkey Parameter in Tomcat context XML.
parse_root_xml_secret() {
  local file="$1"
  [[ -f "${file}" ]] || return 0
  grep -E '^[[:space:]]*<Parameter[[:space:]]+name="jwt\.secretkey"' "${file}" 2>/dev/null \
    | sed -n 's/.*value="\([^"]*\)".*/\1/p' \
    | head -n1 \
    | trim
}

parse_build_properties_secret() {
  local file="$1"
  [[ -f "${file}" ]] || return 0
  grep '^jwt\.secretkey=' "${file}" 2>/dev/null | cut -d= -f2- | head -n1 | trim
}

read_secret_from_war() {
  local war="$1"
  [[ -f "${war}" ]] || return 0
  if command -v unzip >/dev/null 2>&1; then
    unzip -p "${war}" WEB-INF/classes/build.properties 2>/dev/null \
      | grep '^jwt\.secretkey=' \
      | cut -d= -f2- \
      | head -n1 \
      | trim
    return 0
  fi
  return 0
}

read_secret_from_container() {
  if ! docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" ps -q hmdm >/dev/null 2>&1; then
    return 0
  fi
  local container_id
  container_id="$(docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" ps -q hmdm 2>/dev/null | head -n1 || true)"
  [[ -n "${container_id}" ]] || return 0

  docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" exec -T hmdm \
    sh -c '
      for candidate in \
        /usr/local/tomcat/conf/Catalina/localhost/ROOT.xml \
        /usr/local/tomcat/webapps/ROOT/WEB-INF/classes/build.properties
      do
        if [ -f "$candidate" ]; then
          case "$candidate" in
            *.xml)
              grep -E "^[[:space:]]*<Parameter[[:space:]]+name=\"jwt\\.secretkey\"" "$candidate" 2>/dev/null \
                | sed -n "s/.*value=\"\\([^\"]*\\)\".*/\\1/p" \
                | head -n1
              ;;
            *)
              grep "^jwt\\.secretkey=" "$candidate" 2>/dev/null | cut -d= -f2- | head -n1
              ;;
          esac
        fi
      done
      if [ -f /usr/local/tomcat/webapps/ROOT.war ] && command -v unzip >/dev/null 2>&1; then
        unzip -p /usr/local/tomcat/webapps/ROOT.war WEB-INF/classes/build.properties 2>/dev/null \
          | grep "^jwt\\.secretkey=" \
          | cut -d= -f2- \
          | head -n1
      fi
    ' 2>/dev/null | trim | head -n1
}

default_secret() {
  local value=""
  value="$(parse_build_properties_secret "${REPO_DEFAULT_SECRET}")"
  if [[ -n "${value}" ]]; then
    printf '%s' "${value}"
    return
  fi
  printf '%s' "20c68f0d9185b1d18cf6add1e8b491fd89529a44"
}

ensure_root_xml_jwt_secret() {
  local secret="$1"
  if [[ ! -f "${CONTEXT_FILE}" ]]; then
    die "${CONTEXT_FILE} not found — start hmdm once (or run deploy/scripts/fix-hmdm-base-url.sh) so Tomcat creates ROOT.xml"
  fi

  local current
  current="$(parse_root_xml_secret "${CONTEXT_FILE}")"
  if [[ -n "${current}" ]]; then
    if [[ "${current}" != "${secret}" ]]; then
      log "Updating jwt.secretkey in ${CONTEXT_FILE}"
      sed -i "s|^[[:space:]]*<Parameter name=\"jwt\.secretkey\" value=\"[^\"]*\"|    <Parameter name=\"jwt.secretkey\" value=\"${secret}\"|" "${CONTEXT_FILE}"
      return 2
    fi
    return 0
  fi

  log "Adding jwt.secretkey to ${CONTEXT_FILE} (Java was using a random in-memory secret)"
  if grep -q 'name="jwt.secretkey"' "${CONTEXT_FILE}"; then
    sed -i "s|<!--[[:space:]]*<Parameter name=\"jwt\.secretkey\" value=\"[^\"]*\"/>[[:space:]]*-->|<Parameter name=\"jwt.secretkey\" value=\"${secret}\"/>|" "${CONTEXT_FILE}"
  else
    sed -i "s|</Context>|    <Parameter name=\"jwt.secretkey\" value=\"${secret}\"/>\n</Context>|" "${CONTEXT_FILE}"
  fi
  return 2
}

resolve_secret() {
  local value=""

  value="$(parse_root_xml_secret "${CONTEXT_FILE}")"
  if [[ -n "${value}" ]]; then
    printf '%s' "${value}"
    return
  fi

  value="$(read_secret_from_war "${WEBAPPS_WAR}")"
  if [[ -n "${value}" ]]; then
    printf '%s' "${value}"
    return
  fi

  value="$(read_env JWT_SECRET)"
  if [[ -n "${value}" ]]; then
    printf '%s' "${value}"
    return
  fi

  value="$(read_secret_from_container)"
  if [[ -n "${value}" ]]; then
    printf '%s' "${value}"
    return
  fi

  default_secret
}

JAVA_SECRET="$(resolve_secret)"
if [[ -z "${JAVA_SECRET}" ]]; then
  die "could not determine jwt.secretkey (check ${CONTEXT_FILE} and ${WEBAPPS_WAR})"
fi

ROOT_XML_CHANGED=0
ensure_root_xml_jwt_secret "${JAVA_SECRET}" || ROOT_XML_CHANGED=$?
if [[ "${ROOT_XML_CHANGED}" -eq 2 ]]; then
  ROOT_XML_CHANGED=1
fi

CURRENT_SECRET="$(read_env JWT_SECRET)"
ENV_CHANGED=0
if [[ "${CURRENT_SECRET}" != "${JAVA_SECRET}" ]]; then
  log "Updating JWT_SECRET in ${ENV_FILE}"
  if grep -q '^JWT_SECRET=' "${ENV_FILE}"; then
    sed -i "s|^JWT_SECRET=.*|JWT_SECRET=${JAVA_SECRET}|" "${ENV_FILE}"
  else
    printf '\nJWT_SECRET=%s\n' "${JAVA_SECRET}" >> "${ENV_FILE}"
  fi
  ENV_CHANGED=1
else
  log "JWT_SECRET already matches jwt.secretkey (${JAVA_SECRET})"
fi

if [[ "${ROOT_XML_CHANGED}" -eq 1 ]]; then
  log "Restarting hmdm so Java picks up jwt.secretkey from ROOT.xml"
  docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" restart hmdm
  log "Waiting for MDM backend..."
  for _ in $(seq 1 60); do
    if docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" exec -T hmdm \
      wget -q -O /dev/null http://127.0.0.1:8080/rest/public/name 2>/dev/null; then
      break
    fi
    sleep 5
  done
fi

if [[ "${ENV_CHANGED}" -eq 1 || "${ROOT_XML_CHANGED}" -eq 1 ]]; then
  log "Restarting server-windows"
  docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" up -d server-windows
fi

log "Done."
log "Users must sign in again after jwt.secretkey changes."
log "Verify:"
log "  grep JWT_SECRET ${ENV_FILE}"
log "  grep jwt.secretkey ${CONTEXT_FILE}"
