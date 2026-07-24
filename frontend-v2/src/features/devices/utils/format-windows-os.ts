/** Compacts verbose Windows OS strings for the device list, e.g. "Win 11 Pro (24H2)". */
export function formatWindowsOsLabel(raw?: string): string {
  if (!raw?.trim()) {
    return '—'
  }

  const trimmed = raw.trim()
  if (trimmed.length <= 24 && !/microsoft\s+windows/i.test(trimmed)) {
    return trimmed
  }

  const buildMatch = trimmed.match(/(?:\/\s*)?build\s+(\S+)/i)
  const build = buildMatch?.[1]

  const winMatch = trimmed.match(/windows\s+(\d+)\s+(\S+)/i)
  if (winMatch) {
    const version = winMatch[1]
    const edition = winMatch[2]
    return build ? `Win ${version} ${edition} (${build})` : `Win ${version} ${edition}`
  }

  return trimmed
}
