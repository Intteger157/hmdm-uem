import type { InstalledAppEntry } from '@/features/devices/api/device-plugins-api'

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
