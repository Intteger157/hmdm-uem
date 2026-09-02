#!/usr/bin/env bash
# Restore launcher APK files on disk after DB/volume migration.
# Symptom: /files/app-opensource-release.apk → Tomcat 404, QR enrollment fails.
set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${DEPLOY_DIR}/.env"
COMPOSE_FILE="${DEPLOY_DIR}/docker-compose.yml"
CONTEXT_FILE="${DEPLOY_DIR}/volumes/hmdm-config/ROOT.xml"
FILES_DIR="${DEPLOY_DIR}/volumes/files"
WORK_FILES_DIR="${DEPLOY_DIR}/volumes/work/files"
LEGACY_FILES="${HOME}/hmdm-docker/volumes/files"
LEGACY_WORK_FILES="${HOME}/hmdm-docker/volumes/work/files"

read_env() {
  local key="$1"
  local default="${2:-}"
  local value
  value="$(grep "^${key}=" "${ENV_FILE}" 2>/dev/null | cut -d= -f2- || true)"
  printf '%s' "${value:-$default}"
}

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "[restore-launcher-apk] ERROR: ${ENV_FILE} not found" >&2
  exit 1
fi

BASE_DOMAIN="$(read_env BASE_DOMAIN)"
PROTOCOL="$(read_env PROTOCOL http)"
PUBLIC_PROTOCOL="$(read_env PUBLIC_PROTOCOL)"
HMDM_VARIANT="$(read_env HMDM_VARIANT os)"
CLIENT_VERSION="$(read_env CLIENT_VERSION 6.36)"
SQL_USER="$(read_env SQL_USER hmdm)"
SQL_BASE="$(read_env SQL_BASE hmdm)"

if [[ -z "${PUBLIC_PROTOCOL}" ]]; then
  if [[ "${PROTOCOL}" == "http" && -n "${BASE_DOMAIN}" && "${BASE_DOMAIN}" != "localhost" ]]; then
    PUBLIC_PROTOCOL="https"
  else
    PUBLIC_PROTOCOL="${PROTOCOL}"
  fi
fi

PUBLIC_BASE="${PUBLIC_PROTOCOL}://${BASE_DOMAIN}"

resolve_files_directory() {
  local from_xml=""
  if [[ -f "${CONTEXT_FILE}" ]]; then
    from_xml="$(grep 'name="files.directory"' "${CONTEXT_FILE}" | sed -n 's/.*value="\([^"]*\)".*/\1/p' | head -1)"
  fi
  case "${from_xml}" in
    /usr/local/tomcat/work/files|/usr/local/tomcat/work/files/)
      printf '%s' "${WORK_FILES_DIR}"
      ;;
    /opt/hmdm/files|/opt/hmdm/files/)
      printf '%s' "${FILES_DIR}"
      ;;
    *)
      # Legacy hmdm-docker kept APKs under volumes/work/files
      if [[ -d "${WORK_FILES_DIR}" || "${from_xml}" == *tomcat/work* ]]; then
        printf '%s' "${WORK_FILES_DIR}"
      else
        printf '%s' "${FILES_DIR}"
      fi
      ;;
  esac
}

TARGET_FILES_DIR="$(resolve_files_directory)"
echo "[restore-launcher-apk] Tomcat files.directory → host path: ${TARGET_FILES_DIR}"

case "${HMDM_VARIANT}" in
  os) DEFAULT_APK="app-opensource-release.apk" ;;
  master) DEFAULT_APK="app-master-release.apk" ;;
  system) DEFAULT_APK="app-system-release.apk" ;;
  *) DEFAULT_APK="app-opensource-release.apk" ;;
esac

run_psql() {
  docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" exec -T postgresql \
    psql -v ON_ERROR_STOP=1 -U "${SQL_USER}" -d "${SQL_BASE}" "$@"
}

mkdir -p "${FILES_DIR}" "${WORK_FILES_DIR}" "${TARGET_FILES_DIR}"

echo "[restore-launcher-apk] Collecting APK URLs from applicationversions + configurations..."
mapfile -t APK_NAMES < <(run_psql -t -A -c "
SELECT DISTINCT substring(url from '[^/]+\$')
FROM (
  SELECT url FROM applicationversions WHERE url IS NOT NULL AND url LIKE '%/files/%'
  UNION
  SELECT av.url FROM configurations c
  JOIN applicationversions av ON av.id = c.mainappid
  WHERE av.url IS NOT NULL
) t
WHERE substring(url from '[^/]+\$') LIKE '%.apk';
" | sed '/^[[:space:]]*$/d')

if [[ ${#APK_NAMES[@]} -eq 0 ]]; then
  APK_NAMES=("${DEFAULT_APK}")
  echo "[restore-launcher-apk] No APK URLs in DB — will try default ${DEFAULT_APK}"
fi

echo "[restore-launcher-apk] Needed on disk: ${APK_NAMES[*]}"

search_legacy_tree() {
  local name="$1"
  local root="$2"
  [[ -d "${root}" ]] || return 1
  find "${root}" -type f \( -name "${name}" -o -name '*.apk' \) 2>/dev/null | while read -r hit; do
    if [[ "$(basename "${hit}")" == "${name}" ]]; then
      echo "${hit}"
      return 0
    fi
  done
}

try_copy_from_legacy() {
  local name="$1"
  local dest="${TARGET_FILES_DIR}/${name}"
  [[ -f "${dest}" ]] && return 0

  for src in \
    "${LEGACY_WORK_FILES}/${name}" \
    "${LEGACY_FILES}/${name}" \
    "${WORK_FILES_DIR}/${name}" \
    "${FILES_DIR}/${name}"; do
    if [[ -f "${src}" ]]; then
      cp -a "${src}" "${dest}"
      echo "[restore-launcher-apk] Copied ${src} → ${dest}"
      return 0
    fi
  done

  for root in "${LEGACY_WORK_FILES}" "${LEGACY_FILES}" /tmp/volrestore/volumes/work/files; do
    [[ -d "${root}" ]] || continue
    local hit
    hit="$(find "${root}" -type f -name "${name}" 2>/dev/null | head -1 || true)"
    if [[ -n "${hit}" ]]; then
      cp -a "${hit}" "${dest}"
      echo "[restore-launcher-apk] Copied ${hit} → ${dest}"
      return 0
    fi
  done

  for archive in "${HOME}"/backup-volumes*.tgz "${HOME}"/backup-hmdm-docker*.tgz; do
    [[ -f "${archive}" ]] || continue
    echo "[restore-launcher-apk] Searching ${archive} for ${name}..."
    local member
    member="$(tar tzf "${archive}" 2>/dev/null | grep -F "${name}" | head -1 || true)"
    if [[ -n "${member}" ]]; then
      tar xzf "${archive}" -C "${FILES_DIR}" --strip-components=999 "${member}" 2>/dev/null || \
        tar xzf "${archive}" -O "${member}" > "${dest}"
      if [[ -f "${dest}" ]]; then
        echo "[restore-launcher-apk] Extracted ${member} from ${archive}"
        return 0
      fi
      local extracted="${FILES_DIR}/$(basename "${member}")"
      if [[ -f "${extracted}" ]]; then
        mv "${extracted}" "${dest}"
        echo "[restore-launcher-apk] Extracted ${member} from ${archive}"
        return 0
      fi
    fi
  done
  return 1
}

try_copy_from_container() {
  local name="$1"
  local dest="${TARGET_FILES_DIR}/${name}"
  [[ -f "${dest}" ]] && return 0
  local hit
  hit="$(docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" exec -T hmdm \
    sh -c "grep -m1 'files.directory' /usr/local/tomcat/conf/Catalina/localhost/ROOT.xml 2>/dev/null | sed -n 's/.*value=\"\\([^\"]*\\)\".*/\\1/p'" \
    | tr -d '\r' || true)"
  if [[ -n "${hit}" ]]; then
    docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" exec -T hmdm \
      sh -c "test -f '${hit}/${name}' && echo '${hit}/${name}'" 2>/dev/null | tr -d '\r' | while read -r path; do
      docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" cp "hmdm:${path}" "${dest}"
      echo "[restore-launcher-apk] Copied ${path} from hmdm container"
    done
    [[ -f "${dest}" ]] && return 0
  fi
  hit="$(docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" exec -T hmdm \
    sh -c "find /opt/hmdm/files /usr/local/tomcat/work/files -name '${name}' 2>/dev/null | head -1" \
    | tr -d '\r' | sed '/^[[:space:]]*$/d' || true)"
  if [[ -n "${hit}" ]]; then
    docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" cp "hmdm:${hit}" "${dest}"
    echo "[restore-launcher-apk] Copied ${hit} from hmdm container"
    return 0
  fi
  return 1
}

MISSING=()
for name in "${APK_NAMES[@]}"; do
  try_copy_from_legacy "${name}" || try_copy_from_container "${name}" || MISSING+=("${name}")
done

if [[ ${#MISSING[@]} -gt 0 && -f "${TARGET_FILES_DIR}/${DEFAULT_APK}" ]]; then
  for name in "${MISSING[@]}"; do
    if [[ ! -f "${TARGET_FILES_DIR}/${name}" && "${name}" != "${DEFAULT_APK}" ]]; then
      cp -a "${TARGET_FILES_DIR}/${DEFAULT_APK}" "${TARGET_FILES_DIR}/${name}"
      echo "[restore-launcher-apk] WARN: ${name} missing — duplicated ${DEFAULT_APK} (verify version matches!)"
      MISSING=("${MISSING[@]/${name}/}")
    fi
  done
  MISSING=($(printf '%s\n' "${MISSING[@]}" | sed '/^[[:space:]]*$/d' || true))
fi

if [[ ${#MISSING[@]} -gt 0 ]]; then
  echo "[restore-launcher-apk] Still missing: ${MISSING[*]}"
  echo "[restore-launcher-apk] Trying FORCE_RECONFIGURE=true (bundled stock launcher)..."
  docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" stop hmdm
  FORCE_RECONFIGURE=true BASE_DOMAIN="${BASE_DOMAIN}" PROTOCOL="${PROTOCOL}" \
    LOCAL_IP="$(read_env LOCAL_IP)" HMDM_VARIANT="${HMDM_VARIANT}" CLIENT_VERSION="${CLIENT_VERSION}" \
    docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" up -d hmdm
  for _ in $(seq 1 60); do
    if docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" exec -T hmdm \
      wget -q -O /dev/null http://127.0.0.1:8080/rest/public/sync/info 2>/dev/null; then
      break
    fi
    sleep 5
  done
  for name in "${MISSING[@]}"; do
    try_copy_from_legacy "${name}" || try_copy_from_container "${name}" || true
  done
fi

STILL_MISSING=()
for name in "${APK_NAMES[@]}"; do
  [[ -f "${TARGET_FILES_DIR}/${name}" ]] || STILL_MISSING+=("${name}")
done

if [[ ${#STILL_MISSING[@]} -gt 0 ]]; then
  echo "[restore-launcher-apk] ERROR: could not restore: ${STILL_MISSING[*]}" >&2
  echo "  Tomcat files.directory host path: ${TARGET_FILES_DIR}" >&2
  echo "  Manual: cp /tmp/volrestore/volumes/work/files/*.apk ${TARGET_FILES_DIR}/" >&2
  exit 1
fi

chmod 644 "${TARGET_FILES_DIR}/"*.apk 2>/dev/null || true

echo "[restore-launcher-apk] Files on disk (${TARGET_FILES_DIR}):"
ls -la "${TARGET_FILES_DIR}/"*.apk 2>/dev/null || ls -la "${TARGET_FILES_DIR}/"

run_psql -c "
UPDATE applicationversions
SET apkhash = NULL
WHERE url IS NOT NULL AND url LIKE '%/files/%.apk';
"

echo "[restore-launcher-apk] Verify downloads:"
for name in "${APK_NAMES[@]}"; do
  echo "  /files/${name}:"
  curl -sI "http://127.0.0.1:8080/files/${name}" 2>/dev/null | head -3 || true
done

echo "[restore-launcher-apk] Done. Factory-reset the phone and scan a NEW QR code."
