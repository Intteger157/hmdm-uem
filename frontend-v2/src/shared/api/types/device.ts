import type { Platform } from '@/shared/api/types/platform'
import type {
  DeviceDiskVolume,
  InstalledSoftware,
  LocalUser,
  WindowsEncryptionStatus,
  WindowsUpdateItem,
} from '@/shared/api/types/device-detail'

export interface LookupItem {
  id: number
  name: string
}

export interface SelectOption {
  label: string
  value: string
}

export type BitLockerStatus = 'on' | 'off' | 'partial' | 'unknown'
export type PowerShellExecStatus = 'idle' | 'running' | 'failed'
export type WindowsAgentStatus = 'active' | 'uninstalled'

export interface DeviceApplicationView {
  pkg: string
  version?: string
  name?: string
}

export interface DeviceConfigurationFileView {
  path?: string
  lastUpdate?: number
}

export interface DeviceInfoView {
  model?: string
  imei?: string
  phone?: string
  batteryLevel?: number
  mdmMode?: boolean
  kioskMode?: boolean
  androidVersion?: string
  serial?: string
  defaultLauncher?: boolean
  permissions?: number[]
  applications?: DeviceApplicationView[]
  files?: DeviceConfigurationFileView[]
}

export interface ConfigurationApplicationView {
  pkg: string
  version?: string
  url?: string
  action?: number
  selected?: boolean
  skipVersion?: boolean
  name?: string
}

export interface ConfigurationFileView {
  path?: string
  lastUpdate?: number
  remove?: boolean
}

export interface DeviceView {
  id: number
  configurationId: number
  number: string
  description?: string
  lastUpdate?: number
  imei?: string
  phone?: string
  publicIp?: string
  custom1?: string
  custom2?: string
  custom3?: string
  groups?: LookupItem[]
  mdmMode?: boolean
  kioskMode?: boolean
  androidVersion?: string
  enrollTime?: number
  serial?: string
  launcherVersion?: string
  launcherPkg?: string
  statusCode?: string
  oldNumber?: string
  info?: DeviceInfoView
  platform: Platform
  /** Windows-only list columns */
  hostname?: string
  windowsBuild?: string
  windowsAgentStatus?: WindowsAgentStatus
  uninstalledAt?: number
  bitlockerStatus?: BitLockerStatus
  powershellExecStatus?: PowerShellExecStatus
  /** Detail view — hardware & inventory */
  serialNumber?: string
  manufacturer?: string
  model?: string
  cpu?: string
  cpuCores?: number
  cpuThreads?: number
  cpuFrequencyGhz?: number
  ramGb?: number
  diskTotalGb?: number
  diskUsedGb?: number
  diskEncrypted?: boolean
  encryptionStatus?: WindowsEncryptionStatus
  disks?: DeviceDiskVolume[]
  currentUser?: string
  installedSoftware?: InstalledSoftware[]
  localUsers?: LocalUser[]
  /** Windows security & location metrics */
  batteryLevel?: number
  batteryStatus?: string
  uptimeSeconds?: number
  antivirusName?: string
  antivirusActive?: boolean
  antivirusDefinitionsUpdated?: string
  latitude?: number
  longitude?: number
  localIp?: string
  wifiBssid?: string
  pendingUpdates?: number
  lastUpdateCheck?: string
  pendingUpdatesList?: WindowsUpdateItem[]
  installedUpdatesList?: WindowsUpdateItem[]
  bitLockerKey?: string
}

export interface ConfigurationView {
  id: number
  name: string
  qrCodeKey?: string
  baseUrl?: string
  permissiveMode?: boolean
  applications?: ConfigurationApplicationView[]
  files?: ConfigurationFileView[]
}

export interface DeviceUpsertPayload {
  id?: number
  number: string
  description?: string
  configurationId: number
  groups?: LookupItem[]
  imei?: string
  phone?: string
  oldNumber?: string
}

export interface PaginatedData<T> {
  items: T[]
  totalItemsCount: number
}

export interface DeviceListView {
  configurations: Record<string, ConfigurationView>
  devices: PaginatedData<DeviceView>
}

export type DeviceListSortBy =
  | 'STATUS'
  | 'LAST_UPDATE'
  | 'NUMBER'
  | 'IMEI'
  | 'PHONE'
  | 'MODEL'
  | 'CONFIGURATION'
  | 'DESCRIPTION'
  | 'ANDROID_VERSION'
  | 'LAUNCHER_VERSION'
  | 'ENROLLMENT_DATE'
  | 'SERIAL'

export interface DeviceSearchRequest {
  value?: string
  groupId?: number
  configurationId?: number
  pageSize?: number
  pageNum?: number
  sortBy?: DeviceListSortBy
  sortDir?: 'ASC' | 'DESC'
  fastSearch?: boolean
}

export interface DeviceSearchParams {
  platform: Platform
  pageNum: number
  pageSize: number
  value?: string
  sortBy?: DeviceListSortBy
  sortDir?: 'ASC' | 'DESC'
}
