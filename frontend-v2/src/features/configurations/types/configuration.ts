import type { Application } from '@/features/applications/api/applications-api'

/** Application entry embedded in a configuration (from GET /configurations/{id}). */
export type ConfigurationApplication = Application

export interface ConfigurationFileEntry {
  id?: number
  description?: string
  /** Device path (JSON key: path). */
  path?: string
  url?: string
  filePath?: string
  externalUrl?: string
  overridePath?: boolean
  replaceVariables?: boolean
  [key: string]: unknown
}

/** Full configuration entity from Java backend. */
export interface Configuration {
  id?: number
  name: string
  description?: string
  qrCodeKey?: string
  baseUrl?: string
  type?: number
  password?: string
  mainAppId?: number
  contentAppId?: number
  eventReceivingComponent?: string
  launcherUrl?: string

  // Design
  useDefaultDesignSettings?: boolean
  backgroundColor?: string
  textColor?: string
  backgroundImageUrl?: string
  desktopHeaderTemplate?: string
  displayStatus?: boolean
  iconSize?: string
  iconTextColor?: string

  // MDM / device policy
  gps?: boolean
  bluetooth?: boolean
  wifi?: boolean
  mobileData?: boolean
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
  keepaliveTime?: number
  orientation?: number
  passwordMode?: string

  // Kiosk options
  kioskExit?: boolean
  kioskHome?: boolean
  kioskRecents?: boolean
  kioskNotifications?: boolean
  kioskKeyguard?: boolean
  kioskScreenOn?: boolean

  applications?: ConfigurationApplication[]
  files?: ConfigurationFileEntry[]

  /** Preserve unknown backend fields on save. */
  [key: string]: unknown
}

export interface ConfigurationCopyRequest {
  id: number
  name: string
  description?: string
}
