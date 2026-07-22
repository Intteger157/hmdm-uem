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
