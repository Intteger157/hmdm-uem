export interface DeviceInfoGroup {
  id?: number
  name?: string
}

export interface DeviceInfoApplicationEntry {
  applicationName?: string
  applicationPkg?: string
  versionInstalled?: string
  versionRequired?: string
  versionValid?: boolean
}

export interface DeviceInfoDetailsView {
  latestUpdateTime?: number
  latestUpdateInterval?: number
  latestUpdateIntervalType?: string
  groups?: DeviceInfoGroup[]
  applications?: DeviceInfoApplicationEntry[]
  [key: string]: unknown
}

const MAIN_FIELD_ORDER = [
  'latestUpdateTime',
  'deviceNumber',
  'description',
  'groups',
  'imeiRequired',
  'imeiActual',
  'phoneNumberRequired',
  'phoneNumberActual',
  'iccid',
  'imsi',
  'imei2',
  'phone2',
  'iccid2',
  'imsi2',
  'serial',
  'cpu',
  'adminPermission',
  'overlapPermission',
  'historyPermission',
  'accessibilityPermission',
  'model',
  'osVersion',
  'batteryLevel',
  'mdmMode',
  'kioskMode',
  'launcherType',
  'launcherPackage',
  'defaultLauncher',
] as const

const EXCLUDED_FIELDS = new Set(['applications', 'latestDynamicData', 'id', 'latestUpdateInterval', 'latestUpdateIntervalType'])

export function getDeviceInfoMainFields(data: DeviceInfoDetailsView): Array<[string, unknown]> {
  const entries = new Map<string, unknown>()

  for (const key of MAIN_FIELD_ORDER) {
    const value = data[key]
    if (value != null && value !== '') {
      entries.set(key, value)
    }
  }

  for (const [key, value] of Object.entries(data)) {
    if (EXCLUDED_FIELDS.has(key) || entries.has(key)) {
      continue
    }
    if (value == null || value === '') {
      continue
    }
    if (typeof value === 'object') {
      continue
    }
    entries.set(key, value)
  }

  return Array.from(entries.entries())
}

export function formatDeviceInfoScalar(value: unknown): string {
  if (value == null || value === '') {
    return '—'
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false'
  }
  return String(value)
}

export function formatDeviceInfoTimestamp(
  timestamp?: number,
  interval?: number,
  intervalType?: string,
): string {
  if (timestamp == null || timestamp <= 0) {
    return '—'
  }

  const formatted = new Date(timestamp).toLocaleString()
  if (interval != null && intervalType) {
    return `${formatted} (${interval} ${intervalType})`
  }
  return formatted
}

export function formatDeviceInfoGroups(groups: unknown): string[] {
  if (!Array.isArray(groups)) {
    return []
  }

  return groups
    .map((group) => {
      if (group && typeof group === 'object' && 'name' in group) {
        const name = (group as DeviceInfoGroup).name
        return name?.trim() || ''
      }
      return ''
    })
    .filter(Boolean)
}

export function parseDeviceInfoApplications(value: unknown): DeviceInfoApplicationEntry[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((item): item is DeviceInfoApplicationEntry => item != null && typeof item === 'object')
}
