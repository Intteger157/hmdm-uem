import type {
  Configuration,
  ConfigurationEditorDraft,
  TimeZoneMode,
} from '@/features/configurations/types/configuration'
import { getAssignedConfigurationApps } from '@/features/configurations/utils/configuration-app-utils'

const DEFAULT_UPDATE_FROM = '01:00'
const DEFAULT_UPDATE_TO = '05:59'

function padTimePart(value: number): string {
  return String(value).padStart(2, '0')
}

/** Parse "HH:MM" from API; fall back to defaults. */
export function parseTimeField(value: string | undefined, fallback: string): string {
  if (!value) {
    return fallback
  }
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!match) {
    return fallback
  }
  return `${padTimePart(Number(match[1]))}:${match[2]}`
}

/** Convert `<input type="time">` value to backend "HH:MM". */
export function formatTimeForSave(value: string | undefined, fallback: string): string {
  if (!value) {
    return fallback
  }
  const [hours, minutes] = value.split(':')
  if (hours == null || minutes == null) {
    return fallback
  }
  return `${padTimePart(Number(hours))}:${minutes}`
}

export function resolveTimeZoneMode(timeZone: Configuration['timeZone']): TimeZoneMode {
  if (timeZone == null) {
    return 'default'
  }
  if (timeZone === 'auto') {
    return 'auto'
  }
  return 'manual'
}

/** Normalize API configuration into editor draft state. */
export function normalizeConfigurationFromApi(configuration: Configuration): ConfigurationEditorDraft {
  const draft = structuredClone(configuration) as ConfigurationEditorDraft

  draft.timeZoneMode = resolveTimeZoneMode(draft.timeZone)
  draft.passwordMode = draft.passwordMode ?? 'any'
  draft.orientation = draft.orientation ?? 0
  draft.applicationSettings = draft.applicationSettings ?? []
  draft.files = draft.files ?? []
  draft.pushOptions = draft.pushOptions ?? 'mqttAlarm'
  draft.requestUpdates = draft.requestUpdates ?? 'DONOTTRACK'
  draft.appPermissions = draft.appPermissions ?? 'GRANTALL'
  draft.downloadUpdates = draft.downloadUpdates ?? 'UNLIMITED'
  draft.appUpdateFrom = parseTimeField(draft.appUpdateFrom, DEFAULT_UPDATE_FROM)
  draft.appUpdateTo = parseTimeField(draft.appUpdateTo, DEFAULT_UPDATE_TO)
  draft.systemUpdateFrom = parseTimeField(draft.systemUpdateFrom, DEFAULT_UPDATE_FROM)
  draft.systemUpdateTo = parseTimeField(draft.systemUpdateTo, DEFAULT_UPDATE_TO)

  if (draft.keepaliveTime == null && draft.pushOptions === 'mqttAlarm') {
    draft.keepaliveTime = 300
  }

  return draft
}

/** Default skeleton for creating a new configuration (matches legacy config editor id=0). */
export function createEmptyConfigurationDraft(): ConfigurationEditorDraft {
  return normalizeConfigurationFromApi({
    name: '',
    description: '',
    defaultFilePath: '/Download/',
    eventReceivingComponent: 'com.hmdm.launcher.AdminReceiver',
    systemUpdateType: 0,
    useDefaultDesignSettings: true,
    applications: [],
    files: [],
    applicationSettings: [],
  })
}

export interface PrepareConfigurationOptions {
  mainAppSelected: boolean
  contentAppSelected: boolean
}

export function prepareConfigurationForSave(
  configuration: Configuration,
  options?: Partial<PrepareConfigurationOptions>
): Configuration {
  const {
    timeZoneMode,
    applications,
    passwordMode,
    orientation,
    allowedClasses,
    newServerUrl,
    systemUpdateType,
    scheduleAppUpdate,
    appUpdateFrom,
    appUpdateTo,
    systemUpdateFrom,
    systemUpdateTo,
    ...rest
  } = configuration

  const payload: Configuration = {
    ...rest,
    name: configuration.name.trim(),
    description: configuration.description?.trim() || undefined,
    applications: getAssignedConfigurationApps(applications ?? []),
    appUpdateFrom: formatTimeForSave(appUpdateFrom, DEFAULT_UPDATE_FROM),
    appUpdateTo: formatTimeForSave(appUpdateTo, DEFAULT_UPDATE_TO),
  }

  if (passwordMode === 'any' || passwordMode == null) {
    payload.passwordMode = null
  } else {
    payload.passwordMode = passwordMode
  }

  if (timeZoneMode === 'default' || timeZoneMode == null) {
    payload.timeZone = null
  } else if (timeZoneMode === 'auto') {
    payload.timeZone = 'auto'
  } else {
    payload.timeZone = configuration.timeZone ?? undefined
  }

  if (orientation === 0 || orientation == null) {
    payload.orientation = null
  } else {
    payload.orientation = orientation
  }

  payload.allowedClasses =
    allowedClasses == null || String(allowedClasses).trim() === '' ? null : allowedClasses
  payload.newServerUrl =
    newServerUrl == null || String(newServerUrl).trim() === '' ? null : newServerUrl

  if (systemUpdateType === 2) {
    payload.systemUpdateFrom = formatTimeForSave(systemUpdateFrom, DEFAULT_UPDATE_FROM)
    payload.systemUpdateTo = formatTimeForSave(systemUpdateTo, DEFAULT_UPDATE_TO)
  } else {
    delete payload.systemUpdateFrom
    delete payload.systemUpdateTo
  }

  if (!scheduleAppUpdate) {
    payload.scheduleAppUpdate = false
  }

  if (options?.mainAppSelected === false) {
    payload.mainAppId = null
  }
  if (options?.contentAppSelected === false) {
    payload.contentAppId = null
  }

  delete (payload as Configuration & { timeZoneMode?: unknown }).timeZoneMode

  if (payload.id == null || payload.id <= 0) {
    delete payload.id
  }

  return payload
}

export function validateConfigurationDraft(
  configuration: Configuration,
  options: {
    mainAppSelected: boolean
    contentAppSelected: boolean
  }
): string | null {
  if (!configuration.pushOptions) {
    return 'configurations.editor.validation.pushOptions'
  }
  if (!configuration.name?.trim()) {
    return 'configurations.editor.validation.name'
  }
  if (!configuration.password?.trim()) {
    return 'configurations.editor.validation.password'
  }
  if (configuration.kioskMode && !options.contentAppSelected) {
    return 'configurations.editor.validation.contentApp'
  }
  return null
}
