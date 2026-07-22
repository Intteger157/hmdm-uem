import type { ApplicationVersion } from '@/features/applications/api/applications-api'
import type {
  ConfigurationApplication,
  ConfigurationApplicationParameters,
} from '@/features/configurations/types/configuration'
import { compareAppVersions } from '@/features/configurations/utils/app-version-utils'

export interface VersionSelectionResult {
  selectedVersionId: number
  availableVersions: ApplicationVersion[]
  applicationParameters: ConfigurationApplicationParameters
}

export function mergeApplicationUsageParameters(
  existing: ConfigurationApplicationParameters[],
  next: ConfigurationApplicationParameters
): ConfigurationApplicationParameters[] {
  const index = existing.findIndex((item) => item.applicationId === next.applicationId)
  if (index < 0) {
    return [...existing, next]
  }
  const copy = [...existing]
  copy[index] = next
  return copy
}

function cloneApp(app: ConfigurationApplication): ConfigurationApplication {
  return { ...app, actionChanged: true }
}

function syncMainAppId(
  applications: ConfigurationApplication[],
  mainAppId?: number | null,
  mainAppPkg?: string
): number | null | undefined {
  if (!mainAppId || !mainAppPkg) {
    return mainAppId
  }
  const installed = applications.find((app) => app.pkg === mainAppPkg && app.action === 1)
  return installed?.usedVersionId ?? mainAppId
}

/** Apply version picker result to in-memory configuration applications (legacy parity). */
export function applyVersionSelection(
  applications: ConfigurationApplication[],
  application: ConfigurationApplication,
  data: VersionSelectionResult,
  options: {
    mainAppId?: number | null
    contentAppId?: number | null
    mainAppPkg?: string
    contentAppPkg?: string
  }
): {
  applications: ConfigurationApplication[]
  mainAppId?: number | null
  contentAppId?: number | null
} {
  const newAppVersion = data.availableVersions.find(
    (item) => item.id === data.selectedVersionId
  )
  const currentAppVersion = data.availableVersions.find(
    (item) => item.id === application.usedVersionId
  )

  if (!newAppVersion?.id || !currentAppVersion) {
    return {
      applications,
      mainAppId: options.mainAppId,
      contentAppId: options.contentAppId,
    }
  }

  let nextApps = [...applications]
  const comparison = compareAppVersions(newAppVersion.version, currentAppVersion.version)

  if (comparison > 0) {
    nextApps = nextApps.map((app) => {
      if (app.id === newAppVersion.applicationId && app.action === 1) {
        return cloneApp({
          ...app,
          usedVersionId: newAppVersion.id,
          version: newAppVersion.version,
          url: newAppVersion.url,
          outdated: newAppVersion.id !== app.latestVersion,
        })
      }
      return app
    })

    nextApps = nextApps.filter(
      (app) =>
        app.id !== newAppVersion.applicationId ||
        app.action === 1 ||
        app.usedVersionId !== newAppVersion.id
    )
  } else if (comparison < 0) {
    for (const availableAppVersion of data.availableVersions) {
      if (
        compareAppVersions(newAppVersion.version ?? '', availableAppVersion.version ?? '') < 0 &&
        compareAppVersions(availableAppVersion.version ?? '', currentAppVersion.version ?? '') <= 0
      ) {
        const listed = nextApps.some(
          (app) =>
            app.id === newAppVersion.applicationId &&
            app.usedVersionId === availableAppVersion.id
        )

        if (listed) {
          nextApps = nextApps.map((app) =>
            app.id === newAppVersion.applicationId &&
            app.usedVersionId === availableAppVersion.id
              ? cloneApp({ ...app, action: 2 })
              : app
          )
        } else if (availableAppVersion.id) {
          nextApps.push(
            cloneApp({
              ...application,
              version: availableAppVersion.version,
              usedVersionId: availableAppVersion.id,
              action: 2,
            })
          )
        }
      }
    }

    nextApps.push(
      cloneApp({
        ...application,
        version: newAppVersion.version,
        usedVersionId: newAppVersion.id,
        action: 1,
      })
    )

    nextApps = nextApps.filter(
      (app) =>
        app.id !== newAppVersion.applicationId ||
        app.action === 1 ||
        app.usedVersionId !== newAppVersion.id
    )
  }

  nextApps.sort((a, b) => compareAppVersions(a.version, b.version))

  return {
    applications: nextApps,
    mainAppId: syncMainAppId(nextApps, options.mainAppId, options.mainAppPkg),
    contentAppId: syncMainAppId(nextApps, options.contentAppId, options.contentAppPkg),
  }
}
