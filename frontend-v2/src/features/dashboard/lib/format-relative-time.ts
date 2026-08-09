export function formatRelativeTime(fromMs: number, now = Date.now()): string {
  const deltaMs = Math.max(0, now - fromMs)
  const seconds = Math.floor(deltaMs / 1000)

  if (seconds < 60) {
    return 'just now'
  }

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) {
    return `${minutes}m ago`
  }

  const hours = Math.floor(minutes / 60)
  if (hours < 48) {
    return `${hours}h ago`
  }

  const days = Math.floor(hours / 24)
  if (days < 14) {
    return `${days}d ago`
  }

  return new Date(fromMs).toLocaleDateString()
}

export function formatRelativeTimeI18n(
  fromMs: number,
  t: (key: string, options?: Record<string, unknown>) => string,
  now = Date.now(),
): string {
  const deltaMs = Math.max(0, now - fromMs)
  const seconds = Math.floor(deltaMs / 1000)

  if (seconds < 60) {
    return t('dashboard.relative.justNow')
  }

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) {
    return t('dashboard.relative.minutes', { count: minutes })
  }

  const hours = Math.floor(minutes / 60)
  if (hours < 48) {
    return t('dashboard.relative.hours', { count: hours })
  }

  const days = Math.floor(hours / 24)
  if (days < 14) {
    return t('dashboard.relative.days', { count: days })
  }

  return new Date(fromMs).toLocaleDateString()
}
