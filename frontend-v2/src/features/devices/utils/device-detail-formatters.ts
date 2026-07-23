import type { DeviceView } from '@/shared/api/types/device'

const NA = 'N/A'

export function formatDeviceTimestamp(ms?: number): string {
  if (!ms || ms <= 0) return '—'
  return new Date(ms).toLocaleString()
}

export function formatDeviceEnrollTime(ms?: number): string {
  if (!ms || ms <= 0) return NA
  return new Date(ms).toLocaleString()
}

export function resolveEnrollTime(device: DeviceView): number | undefined {
  const raw = device.enrollTime
  const parsed = typeof raw === 'number' ? raw : Number(raw)

  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed
  }

  return undefined
}

export function resolveLauncherVersion(device: DeviceView): string | undefined {
  const version = device.launcherVersion
  if (version && version !== '0') {
    return version
  }

  const apps = device.info?.applications ?? []
  const pkg = device.launcherPkg
  if (pkg) {
    const launcherApp = apps.find((app) => app.pkg === pkg)
    if (launcherApp?.version && launcherApp.version !== '0') {
      return launcherApp.version
    }
  }

  const hmdmLauncher = apps.find((app) => app.pkg === 'com.hmdm.launcher')
  if (hmdmLauncher?.version && hmdmLauncher.version !== '0') {
    return hmdmLauncher.version
  }

  return undefined
}

export function resolvePublicIp(device: DeviceView): string | undefined {
  const ip = device.publicIp?.trim()
  return ip || undefined
}

export function formatUptime(seconds?: number): string {
  if (!seconds || seconds <= 0) {
    return NA
  }

  const days = Math.floor(seconds / 86_400)
  const hours = Math.floor((seconds % 86_400) / 3_600)
  const minutes = Math.floor((seconds % 3_600) / 60)

  const parts: string[] = []
  if (days > 0) {
    parts.push(`${days} day${days === 1 ? '' : 's'}`)
  }
  if (hours > 0) {
    parts.push(`${hours} hour${hours === 1 ? '' : 's'}`)
  }
  if (parts.length === 0) {
    parts.push(`${minutes} min`)
  }
  return parts.join(', ')
}

export function formatWindowsUpdateCheck(raw?: string, fallback = 'N/A'): string {
  const value = raw?.trim()
  if (!value) {
    return fallback
  }
  const parsed = Date.parse(value)
  if (Number.isFinite(parsed) && parsed > 0) {
    return new Date(parsed).toLocaleString()
  }
  return value
}

/** Hides machine/service accounts that the agent may report instead of a logged-in user. */
export function formatWindowsCurrentUser(
  raw?: string,
  fallback = 'N/A',
  localUsers?: { username: string; status?: string }[],
): string {
  const username = raw?.trim()
  if (username && !username.endsWith('$')) {
    const lower = username.toLowerCase()
    if (lower !== 'system' && lower !== 'local service' && lower !== 'network service') {
      return username
    }
  }

  const activeUser = localUsers?.find(
    (user) =>
      user.status === 'active' &&
      !user.username.endsWith('$') &&
      !['Guest', 'DefaultAccount', 'WDAGUtilityAccount'].includes(user.username),
  )
  if (activeUser?.username) {
    return activeUser.username
  }

  return fallback
}
