import type { Platform } from '@/shared/api/types/platform'
import type { InstalledSoftware, LocalUser } from '@/shared/api/types/device-detail'

export interface LookupItem {
  id: number
  name: string
}

export type BitLockerStatus = 'on' | 'off' | 'unknown'
export type PowerShellExecStatus = 'idle' | 'running' | 'failed'

export interface DeviceApplicationView {
  pkg: string
  version?: string
  name?: string
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
  applications?: DeviceApplicationView[]
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
  info?: DeviceInfoView
  platform: Platform
  /** Windows-only list columns */
  hostname?: string
  windowsBuild?: string
  bitlockerStatus?: BitLockerStatus
  powershellExecStatus?: PowerShellExecStatus
  /** Detail view — hardware & inventory */
  serialNumber?: string
  manufacturer?: string
  model?: string
  cpu?: string
  ramGb?: number
  diskTotalGb?: number
  diskUsedGb?: number
  diskEncrypted?: boolean
  currentUser?: string
  installedSoftware?: InstalledSoftware[]
  localUsers?: LocalUser[]
}

export interface ConfigurationView {
  id: number
  name: string
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
