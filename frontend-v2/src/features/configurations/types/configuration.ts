import type { Application } from '@/features/applications/api/applications-api'

/** Application entry embedded in a configuration (from GET /configurations/{id}). */
export type ConfigurationApplication = Application

export interface ConfigurationFileEntry {
  id?: number | null
  fileId?: number
  description?: string
  /** Device path (JSON key: path). */
  path?: string
  url?: string
  filePath?: string
  externalUrl?: string
  overridePath?: boolean
  replaceVariables?: boolean
  remove?: boolean
  lastUpdate?: number
  tempId?: number
  external?: boolean
  [key: string]: unknown
}

export interface ApplicationSetting {
  id?: number
  tempId?: number
  applicationId?: number
  applicationPkg?: string
  applicationName?: string
  name?: string
  type?: string
  value?: string
  comment?: string
  lastUpdate?: number
  readonly?: boolean
  variable?: boolean
  extRefId?: number
  [key: string]: unknown
}

export interface ConfigurationApplicationParameters {
  id?: number
  configurationId?: number
  applicationId?: number
  skipVersionCheck?: boolean
  [key: string]: unknown
}

export type TimeZoneMode = 'default' | 'auto' | 'manual'

/** Full configuration entity from Java backend. */
export interface Configuration {
  id?: number
  name: string
  description?: string
  qrCodeKey?: string
  baseUrl?: string
  type?: number
  password?: string
  mainAppId?: number | null
  contentAppId?: number | null
  eventReceivingComponent?: string
  launcherUrl?: string

  // Common policy
  requestUpdates?: string
  appPermissions?: string
  pushOptions?: string
  autoBrightness?: boolean | null
  brightness?: number
  manageTimeout?: boolean
  timeout?: number
  lockVolume?: boolean
  manageVolume?: boolean
  volume?: number
  timeZone?: string | null
  /** UI-only; derived from timeZone on load, not sent to API. */
  timeZoneMode?: TimeZoneMode
  systemUpdateType?: number
  systemUpdateFrom?: string
  systemUpdateTo?: string
  scheduleAppUpdate?: boolean
  appUpdateFrom?: string
  appUpdateTo?: string
  downloadUpdates?: string
  passwordMode?: string | null
  showWifi?: boolean
  autostartForeground?: boolean
  defaultFilePath?: string

  // Design
  useDefaultDesignSettings?: boolean
  backgroundColor?: string
  textColor?: string
  backgroundImageUrl?: string
  desktopHeader?: string
  desktopHeaderTemplate?: string
  displayStatus?: boolean
  iconSize?: string
  iconTextColor?: string

  // MDM / device policy
  gps?: boolean | null
  bluetooth?: boolean | null
  wifi?: boolean | null
  mobileData?: boolean | null
  usbStorage?: boolean
  disableLocation?: boolean
  blockStatusBar?: boolean
  kioskMode?: boolean
  permissive?: boolean
  encryptDevice?: boolean
  mobileEnrollment?: boolean
  runDefaultLauncher?: boolean
  disableScreenshots?: boolean
  wifiSSID?: string
  wifiPassword?: string
  wifiSecurityType?: string
  keepaliveTime?: number | null
  orientation?: number | null
  qrParameters?: string
  adminExtras?: string
  lockSafeSettings?: boolean
  allowedClasses?: string | null
  restrictions?: string
  newServerUrl?: string | null

  // Kiosk options
  kioskExit?: boolean
  kioskHome?: boolean
  kioskRecents?: boolean
  kioskNotifications?: boolean
  kioskSystemInfo?: boolean
  kioskKeyguard?: boolean
  kioskLockButtons?: boolean
  kioskScreenOn?: boolean

  applications?: ConfigurationApplication[]
  files?: ConfigurationFileEntry[]
  applicationSettings?: ApplicationSetting[]
  applicationUsageParameters?: ConfigurationApplicationParameters[]

  /** Preserve unknown backend fields on save. */
  [key: string]: unknown
}

export interface ConfigurationCopyRequest {
  id: number
  name: string
  description?: string
}

export interface ConfigurationEditorDraft extends Configuration {
  timeZoneMode: TimeZoneMode
}
