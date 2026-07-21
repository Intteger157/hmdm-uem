import type { Platform } from '@/shared/api/types/platform'

export interface LookupItem {
  id: number
  name: string
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
  groups?: LookupItem[]
  mdmMode?: boolean
  kioskMode?: boolean
  androidVersion?: string
  enrollTime?: number
  serial?: string
  launcherVersion?: string
  statusCode?: string
  info?: DeviceInfoView
  platform: Platform
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
