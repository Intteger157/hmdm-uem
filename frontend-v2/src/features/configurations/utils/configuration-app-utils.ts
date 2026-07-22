import type { ConfigurationApplication } from '@/features/configurations/types/configuration'
import type { Configuration } from '@/features/configurations/types/configuration'

export type ConfigurationAppSortBy = 'name' | 'pkg'

const SHOW_SYSTEM_APPS_KEY = 'HMDM_configShowSystemApps'
const CONFIG_APPS_SORT_KEY = 'HMDM_configAppsSortBy'

export function formatConfigurationAppLabel(app: ConfigurationApplication): string {
  const version = app.version && app.version !== '0' ? ` ${app.version}` : ''
  return `${app.name}${version}`
}

export function isInstallOptionAvailable(app: ConfigurationApplication): boolean {
  return (
    !app.system &&
    app.type === 'app' &&
    Boolean(app.url || app.urlArm64 || app.urlArmeabi)
  )
}

export function isRemoveOptionAvailable(app: ConfigurationApplication): boolean {
  return !app.system && app.type === 'app'
}

export function pkgInfoVisible(app: ConfigurationApplication): boolean {
  return app.type === 'app'
}

export function isInstallableConfigApp(app: ConfigurationApplication): boolean {
  return app.type === 'app' && app.action === 1
}

export function getShowSystemAppsPreference(): boolean {
  if (typeof window === 'undefined') {
    return false
  }
  const stored = window.localStorage.getItem(SHOW_SYSTEM_APPS_KEY)
  if (stored == null) {
    return false
  }
  return stored === 'true'
}

export function setShowSystemAppsPreference(value: boolean): void {
  window.localStorage.setItem(SHOW_SYSTEM_APPS_KEY, String(value))
}

export function getConfigurationAppsSortPreference(): ConfigurationAppSortBy {
  if (typeof window === 'undefined') {
    return 'name'
  }
  const stored = window.localStorage.getItem(CONFIG_APPS_SORT_KEY)
  return stored === 'pkg' ? 'pkg' : 'name'
}

export function setConfigurationAppsSortPreference(value: ConfigurationAppSortBy): void {
  window.localStorage.setItem(CONFIG_APPS_SORT_KEY, value)
}

export function isAssignedConfigurationApp(app: ConfigurationApplication): boolean {
  if (Boolean(app.actionChanged)) {
    return app.action != null && app.action !== 0
  }
  return app.action != null && app.action !== 0
}

export function filterConfigurationTableApps(
  apps: ConfigurationApplication[],
  options: {
    showSystemApps: boolean
    searchText?: string
  }
): ConfigurationApplication[] {
  const search = (options.searchText ?? '').trim().toLowerCase()

  return apps
    .filter((app) => {
      const visibleByAction = isAssignedConfigurationApp(app)
      const visibleBySystem = options.showSystemApps || !app.system
      if (!visibleByAction || !visibleBySystem) {
        return false
      }

      if (!search) {
        return true
      }

      return (
        app.name.toLowerCase().includes(search) ||
        (app.type === 'app' && (app.pkg?.toLowerCase().includes(search) ?? false))
      )
    })
    .sort((a, b) => compareApps(a, b, getConfigurationAppsSortPreference()))
}

export function getAvailableAppsForAdd(
  apps: ConfigurationApplication[]
): ConfigurationApplication[] {
  return apps.filter((app) => app.action === 0 && !app.actionChanged)
}

export function filterAvailableAppsForAdd(
  apps: ConfigurationApplication[],
  query: string
): ConfigurationApplication[] {
  const lower = query.trim().toLowerCase()
  const available = getAvailableAppsForAdd(apps)

  if (!lower) {
    return [...available].sort((a, b) => compareApps(a, b, 'name'))
  }

  return available
    .filter(
      (app) =>
        app.name.toLowerCase().includes(lower) ||
        (app.pkg?.toLowerCase().includes(lower) ?? false) ||
        (app.version?.toLowerCase().includes(lower) ?? false)
    )
    .sort((a, b) => compareApps(a, b, 'name'))
}

function compareApps(
  a: ConfigurationApplication,
  b: ConfigurationApplication,
  sortBy: ConfigurationAppSortBy
): number {
  if (sortBy === 'pkg') {
    const pkgCompare = (a.pkg ?? '').localeCompare(b.pkg ?? '', undefined, { sensitivity: 'base' })
    if (pkgCompare !== 0) {
      return pkgCompare
    }
  }
  return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
}

export function filterInstallableConfigApps(
  apps: ConfigurationApplication[],
  query: string
): ConfigurationApplication[] {
  const lower = query.trim().toLowerCase()
  const installable = apps.filter(isInstallableConfigApp)

  if (!lower) {
    return [...installable].sort((a, b) => compareApps(a, b, 'name'))
  }

  return installable
    .filter(
      (app) =>
        app.name.toLowerCase().includes(lower) ||
        (app.pkg?.toLowerCase().includes(lower) ?? false) ||
        (app.version?.toLowerCase().includes(lower) ?? false)
    )
    .sort((a, b) => compareApps(a, b, 'name'))
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

export function applyActionChange(
  applications: ConfigurationApplication[],
  updatedApp: ConfigurationApplication,
  nextAction: number
): ConfigurationApplication[] {
  return applications.map((app) => {
    const sameRow =
      app.usedVersionId != null && app.usedVersionId === updatedApp.usedVersionId
        ? true
        : app.id === updatedApp.id && app.usedVersionId === updatedApp.usedVersionId

    if (!sameRow) {
      if (nextAction === 1 && app.pkg === updatedApp.pkg && app.action === 1) {
        return { ...app, action: 0, actionChanged: true }
      }
      return app
    }

    return {
      ...app,
      action: nextAction,
      actionChanged: true,
      remove: nextAction === 2,
    }
  })
}

export function applyMainAppSelection(
  applications: ConfigurationApplication[],
  selected: ConfigurationApplication
): ConfigurationApplication[] {
  return applications.map((app) => {
    if (app.usedVersionId === selected.usedVersionId) {
      return { ...app, action: 1, actionChanged: true }
    }
    if (app.pkg === selected.pkg && app.action === 1) {
      return { ...app, action: 0, actionChanged: true }
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

export function addAppToConfiguration(
  applications: ConfigurationApplication[],
  addedApp: ConfigurationApplication
): ConfigurationApplication[] {
  const normalized: ConfigurationApplication = {
    ...addedApp,
    actionChanged: true,
    usedVersionId: addedApp.usedVersionId ?? addedApp.latestVersion,
  }

  let next = [...applications]

  if (normalized.action === 1 && normalized.pkg) {
    next = next.map((app) =>
      app.pkg === normalized.pkg &&
      app.usedVersionId !== normalized.usedVersionId &&
      app.action === 1
        ? { ...app, action: 0, actionChanged: true }
        : app
    )
  }

  const index = next.findIndex(
    (app) =>
      (normalized.usedVersionId != null && app.usedVersionId === normalized.usedVersionId) ||
      (normalized.id != null &&
        app.id === normalized.id &&
        (app.action === 0 || app.action == null))
  )

  if (index >= 0) {
    next[index] = { ...next[index], ...normalized }
  } else {
    next.push(normalized)
  }

  return next
}

export function updateConfigurationApplication(
  applications: ConfigurationApplication[],
  updatedApp: ConfigurationApplication
): ConfigurationApplication[] {
  return applications.map((app) =>
    app.usedVersionId === updatedApp.usedVersionId ? { ...updatedApp, actionChanged: true } : app
  )
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

export { prepareConfigurationForSave, validateConfigurationDraft } from '@/features/configurations/utils/configuration-normalize'
