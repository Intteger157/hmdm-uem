export function readCookie(name: string): string | null {
  if (typeof document === 'undefined') {
    return null
  }

  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

export function clearCookie(name: string, path = '/'): void {
  if (typeof document === 'undefined') {
    return
  }

  document.cookie = `${name}=; Max-Age=0; path=${path}`
}
