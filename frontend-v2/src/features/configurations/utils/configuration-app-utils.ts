import type { ConfigurationApplication } from '@/features/configurations/types/configuration'
import type { Configuration } from '@/features/configurations/types/configuration'

export function formatConfigurationAppLabel(app: ConfigurationApplication): string {
  const version =
    app.version && app.version !== '0' ? ` ${app.version}` : ''
  return `${app.name}${version}`
}

export function isInstallableConfigApp(app: ConfigurationApplication): boolean {
  return app.type === 'app' && app.action === 1
}

export function filterInstallableConfigApps(
  apps: ConfigurationApplication[],
  query: string
): ConfigurationApplication[] {
  const lower = query.trim().toLowerCase()
  const installable = apps.filter(isInstallableConfigApp)

  if (!lower) {
    return [...installable].sort(compareAppsByName)
  }

  return installable
    .filter(
      (app) =>
        app.name.toLowerCase().includes(lower) ||
        (app.pkg?.toLowerCase().includes(lower) ?? false) ||
        (app.version?.toLowerCase().includes(lower) ?? false)
    )
    .sort(compareAppsByName)
}

function compareAppsByName(a: ConfigurationApplication, b: ConfigurationApplication): number {
  return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
}

export function findConfigAppByUsedVersionId(
  apps: ConfigurationApplication[],
  usedVersionId: number | undefined
): ConfigurationApplication | undefined {
  if (usedVersionId == null || usedVersionId <= 0) {
    return undefined
  }
  return apps.find((app) => app.usedVersionId === usedVersionId)
}

export function applyMainAppSelection(
  applications: ConfigurationApplication[],
  selected: ConfigurationApplication
): ConfigurationApplication[] {
  return applications.map((app) => {
    if (app.usedVersionId === selected.usedVersionId) {
      return { ...app, action: 1 }
    }
    if (app.pkg === selected.pkg && app.action === 1) {
      return { ...app, action: 0 }
    }
    return app
  })
}

export function applyContentAppSelection(
  applications: ConfigurationApplication[],
  selected: ConfigurationApplication
): ConfigurationApplication[] {
  return applyMainAppSelection(applications, selected)
}

export function getAssignedConfigurationApps(
  applications: ConfigurationApplication[]
): ConfigurationApplication[] {
  return applications.filter((app) => app.action != null && app.action !== 0)
}

export function isQrEnrollmentReady(configuration: Configuration): boolean {
  return Boolean(
    configuration.qrCodeKey &&
      configuration.mainAppId != null &&
      configuration.mainAppId > 0 &&
      configuration.eventReceivingComponent?.trim()
  )
}

export function buildConfigurationQrUrl(configuration: Configuration): string | null {
  if (!isQrEnrollmentReady(configuration)) {
    return null
  }

  const base =
    configuration.baseUrl?.replace(/\/$/, '') ??
    (typeof window !== 'undefined' ? window.location.origin : '')

  return `${base}/#/qr/${configuration.qrCodeKey}/`
}

export function prepareConfigurationForSave(configuration: Configuration): Configuration {
  return {
    ...configuration,
    name: configuration.name.trim(),
    description: configuration.description?.trim() || undefined,
    applications: getAssignedConfigurationApps(configuration.applications ?? []),
  }
}
