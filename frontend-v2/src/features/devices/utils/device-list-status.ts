import { compareAppVersions } from '@/features/configurations/utils/app-version-utils'
import type { ConfigurationView, DeviceView } from '@/shared/api/types/device'

export type DeviceStatusIndicator = 'green' | 'yellow' | 'red' | 'grey'

function aggregateStatuses(statuses: number[]): DeviceStatusIndicator {
  if (statuses.length === 0) {
    return 'grey'
  }

  let correct = 0
  let incorrect = 0
  let notInstalled = 0

  for (const status of statuses) {
    if (status === 3) {
      correct += 1
    } else if (status === 2 || status === 4) {
      incorrect += 1
    } else if (status === 1) {
      notInstalled += 1
    }
  }

  if (correct === statuses.length) {
    return 'green'
  }
  if (notInstalled > 0) {
    return 'red'
  }
  if (incorrect > 0) {
    return 'yellow'
  }
  return 'grey'
}

export function getDevicePermissionIndicator(
  device: DeviceView,
  configuration?: ConfigurationView,
): DeviceStatusIndicator {
  const info = device.info
  if (!info) {
    return 'red'
  }

  if (info.kioskMode === true || device.kioskMode === true || configuration?.permissiveMode === true) {
    return 'green'
  }

  const permissions = info.permissions
  if (!permissions || permissions.length < 3) {
    return 'red'
  }

  const sum = permissions[0] + permissions[1] + permissions[2]
  if (sum === 0) {
    return 'red'
  }
  if (sum < 3) {
    return 'yellow'
  }
  return 'green'
}

function isVersionUpToDate(installed?: string, required?: string): boolean {
  return compareAppVersions(installed, required) >= 0
}

function computeApplicationStatuses(device: DeviceView, configuration?: ConfigurationView): number[] {
  const info = device.info
  const configApps = configuration?.applications ?? []
  if (!info) {
    return []
  }

  const deviceApps = info.applications ?? []
  const statuses: number[] = []

  for (const configApp of configApps) {
    if (!configApp.selected || !configApp.url) {
      continue
    }

    let status = 3
    let found = false

    for (const deviceApp of deviceApps) {
      if (deviceApp.pkg !== configApp.pkg) {
        continue
      }
      found = true

      if (configApp.action === 2) {
        if (configApp.version === deviceApp.version) {
          status = 4
        }
      } else if (
        configApp.version !== '0' &&
        !configApp.skipVersion &&
        !isVersionUpToDate(deviceApp.version, configApp.version)
      ) {
        status = 2
      }
      break
    }

    if (!found && configApp.action !== 2) {
      status = 1
    }

    statuses.push(status)
  }

  return statuses
}

export function getDeviceInstallIndicator(
  device: DeviceView,
  configuration?: ConfigurationView,
): DeviceStatusIndicator {
  const statuses = computeApplicationStatuses(device, configuration)
  if (statuses.length === 0) {
    return device.info ? 'green' : 'red'
  }
  return aggregateStatuses(statuses)
}

function computeFileStatuses(device: DeviceView, configuration?: ConfigurationView): number[] {
  const info = device.info
  const configFiles = configuration?.files ?? []
  if (!info) {
    return []
  }

  const deviceFiles = info.files ?? []
  const statuses: number[] = []

  for (const configFile of configFiles) {
    let status = 3
    let found = false

    for (const deviceFile of deviceFiles) {
      if (deviceFile.path !== configFile.path) {
        continue
      }
      found = true
      if (
        configFile.lastUpdate != null &&
        deviceFile.lastUpdate != null &&
        configFile.lastUpdate !== deviceFile.lastUpdate &&
        Math.abs(configFile.lastUpdate - deviceFile.lastUpdate) > 3_600_000
      ) {
        status = 2
      }
      break
    }

    if (!found && configFile.remove === false) {
      status = 1
    }

    statuses.push(status)
  }

  return statuses
}

export function getDeviceFilesIndicator(
  device: DeviceView,
  configuration?: ConfigurationView,
): DeviceStatusIndicator {
  const statuses = computeFileStatuses(device, configuration)
  if (statuses.length === 0) {
    return device.info ? 'green' : 'red'
  }
  return aggregateStatuses(statuses)
}

export function resolveDeviceConfiguration(
  configurations: Record<string, ConfigurationView>,
  configurationId: number,
): ConfigurationView | undefined {
  return (
    configurations[String(configurationId)] ??
    Object.values(configurations).find((config) => config.id === configurationId)
  )
}
