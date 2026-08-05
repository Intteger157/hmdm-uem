const MICROSOFT_CALLBACK_PATH = '/rest/windows/public/auth/callback/microsoft'

export function buildMicrosoftSsoRedirectUri(origin?: string): string {
  const base =
    origin ??
    (typeof window !== 'undefined' ? window.location.origin : '')
  return `${base.replace(/\/$/, '')}${MICROSOFT_CALLBACK_PATH}`
}

export { MICROSOFT_CALLBACK_PATH }
