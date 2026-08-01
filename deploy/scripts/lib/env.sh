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
