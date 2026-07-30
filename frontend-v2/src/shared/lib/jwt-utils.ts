/** Decode a JWT segment without verifying the signature. */
function decodeJwtSegment(segment: string): unknown {
  const normalized = segment.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=')
  return JSON.parse(atob(padded))
}

/**
 * Reject tokens that cannot have been issued by the Java console login flow.
 * Used on persisted auth rehydration to clear stale dev/mock tokens.
 */
export function isLikelyConsoleJwt(token: string): boolean {
  const parts = token.split('.')
  if (parts.length !== 3 || parts.some((part) => part.length === 0)) {
    return false
  }

  try {
    const header = decodeJwtSegment(parts[0]) as { alg?: string }
    if (header.alg !== 'HS512' && header.alg !== 'HS256') {
      return false
    }

    const payload = decodeJwtSegment(parts[1]) as { sub?: string; exp?: number }
    if (!payload.sub?.trim()) {
      return false
    }

    const exp = payload.exp
    if (typeof exp !== 'number' || exp < 1_000_000_000 || exp > 99_999_999_999) {
      return false
    }

    return true
  } catch {
    return false
  }
}
