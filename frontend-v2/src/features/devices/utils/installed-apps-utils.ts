import type { InstalledAppEntry } from '@/features/devices/api/device-plugins-api'
import type { DeviceApplicationView } from '@/shared/api/types/device'

export function appsFromDeviceInfo(
  applications?: DeviceApplicationView[]
): InstalledAppEntry[] {
  if (!applications?.length) {
    return []
  }

  const seen = new Set<string>()
  const result: InstalledAppEntry[] = []

  for (const app of applications) {
    const pkg = app.pkg?.trim()
    if (!pkg) {
      continue
    }

    const key = pkg.toLowerCase()
    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    result.push({
      pkg,
      name: app.name ?? pkg,
      version: app.version,
      system: false,
    })
  }

  return result.sort((a, b) => (a.name ?? a.pkg ?? '').localeCompare(b.name ?? b.pkg ?? ''))
}

export function mergeInstalledApps(
  inventoryApps: InstalledAppEntry[],
  syncApps: InstalledAppEntry[]
): InstalledAppEntry[] {
  if (inventoryApps.length > 0) {
    return inventoryApps
  }

  return syncApps
}
