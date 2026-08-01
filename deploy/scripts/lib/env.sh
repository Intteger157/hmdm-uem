#!/usr/bin/env bash
# Shared deploy/.env reader (strips CRLF, whitespace, and inline # comments).

env_trim() {
  tr -d '\r' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//'
}

env_strip_inline_comment() {
  sed 's/[[:space:]]\+#.*$//'
}

read_env() {
  local key="$1"
  local default="${2:-}"
  local file="${ENV_FILE:-}"
  local value=""

  if [[ -n "${file}" && -f "${file}" ]]; then
    value="$(grep "^${key}=" "${file}" 2>/dev/null | head -n1 | cut -d= -f2- || true)"
    value="$(printf '%s' "${value}" | env_strip_inline_comment | env_trim)"
  fi

  if [[ -n "${value}" ]]; then
    printf '%s' "${value}"
  else
    printf '%s' "${default}"
  fi
}

env_bool() {
  case "$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')" in
    1 | true | yes | on) printf 'true' ;;
    *) printf 'false' ;;
  esac
}

env_require_no_inline_comment() {
  local key="$1"
  local raw=""
  local file="${ENV_FILE:-}"

  if [[ -z "${file}" || ! -f "${file}" ]]; then
    return 0
  fi

  raw="$(grep "^${key}=" "${file}" 2>/dev/null | head -n1 | cut -d= -f2- || true)"
  if [[ "${raw}" == *"#"* ]]; then
    printf '%s\n' "ERROR: ${key} in ${file} has an inline comment on the same line." >&2
    printf '%s\n' "Put comments on the line above, e.g.:" >&2
    printf '%s\n' "  # my note" >&2
    printf '%s\n' "  ${key}=value" >&2
    printf '%s\n' "Current line: ${key}=${raw}" >&2
    return 1
  fi
  return 0
}
