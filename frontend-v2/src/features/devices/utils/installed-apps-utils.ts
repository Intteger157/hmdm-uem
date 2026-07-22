import type { InstalledAppEntry } from '@/features/devices/api/device-plugins-api'
import type { DeviceApplicationView } from '@/shared/api/types/device'

export const INVENTORY_HELPER_PKG = 'com.hmdm.inventory'

export function appsFromDeviceInfo(
  applications?: DeviceApplicationView[],
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

  return sortInstalledApps(result)
}

export function hasInventoryHelperInstalled(applications?: DeviceApplicationView[]): boolean {
  return appsFromDeviceInfo(applications).some(
    (app) => app.pkg?.toLowerCase() === INVENTORY_HELPER_PKG,
  )
}

export function sortInstalledApps(apps: InstalledAppEntry[]): InstalledAppEntry[] {
  return [...apps].sort((a, b) =>
    (a.name ?? a.pkg ?? '').localeCompare(b.name ?? b.pkg ?? '', undefined, {
      sensitivity: 'base',
    }),
  )
}

export function filterInstalledApps(apps: InstalledAppEntry[], query: string): InstalledAppEntry[] {
  const sorted = sortInstalledApps(apps)
  const trimmed = query.trim().toLowerCase()

  if (!trimmed) {
    return sorted
  }

  return sorted.filter(
    (app) =>
      (app.name ?? '').toLowerCase().includes(trimmed) ||
      (app.pkg ?? '').toLowerCase().includes(trimmed) ||
      (app.version ?? '').toLowerCase().includes(trimmed),
  )
}

export function installedAppDisplayName(app: InstalledAppEntry): string {
  const name = app.name?.trim()
  const pkg = app.pkg?.trim()

  if (name && name !== pkg) {
    return name
  }

  return name ?? pkg ?? '—'
}
