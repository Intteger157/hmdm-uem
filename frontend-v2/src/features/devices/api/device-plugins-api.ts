import { api } from '@/shared/api/client'
import type { ApplicationSetting } from '@/features/configurations/types/configuration'
import type { ApiResponse } from '@/shared/api/types/api-response'
import { unwrapApiResponse } from '@/shared/api/types/api-response'
import type { PaginatedData } from '@/shared/api/types/device'

export interface DeviceLogRecord {
  deviceNumber?: string
  createTime?: number
  applicationPkg?: string
  severity?: string
  message?: string
}

export interface DeviceInfoDetails {
  [key: string]: unknown
}

export interface InstalledAppEntry {
  pkg?: string
  name?: string
  version?: string
  system?: boolean
}

export interface DeviceInventoryView {
  deviceNumber?: string
  lastUpdate?: number
  applications?: InstalledAppEntry[]
}

export interface LocationPoint {
  lat?: number
  lon?: number
  ts?: number
  source?: string
}

export interface DeviceLocationView {
  deviceNumber?: string
  lat?: number
  lon?: number
  ts?: number
  source?: string
  history?: LocationPoint[]
}

export interface DeviceResetStatus {
  locked?: boolean
  lockMessage?: string
  pendingAction?: string
}

export async function fetchDeviceApplicationSettings(deviceId: number): Promise<ApplicationSetting[]> {
  const response = await api.get<ApiResponse<ApplicationSetting[]>>(
    `/private/devices/${deviceId}/applicationSettings`,
  )
  return unwrapApiResponse(response.data) ?? []
}

export async function saveDeviceApplicationSettings(
  deviceId: number,
  settings: ApplicationSetting[],
): Promise<void> {
  const response = await api.post<ApiResponse<unknown>>(
    `/private/devices/${deviceId}/applicationSettings`,
    settings,
  )
  unwrapApiResponse(response.data)
}

export async function notifyDeviceApplicationSettings(deviceId: number): Promise<void> {
  const response = await api.post<ApiResponse<unknown>>(
    `/private/devices/${deviceId}/applicationSettings/notify`,
    {},
  )
  unwrapApiResponse(response.data)
}

export async function searchDeviceLogs(
  deviceNumber: string,
  pageNum = 1,
  pageSize = 50,
): Promise<PaginatedData<DeviceLogRecord>> {
  const response = await api.post<ApiResponse<PaginatedData<DeviceLogRecord>>>(
    '/plugins/devicelog/log/private/search',
    {
      deviceFilter: deviceNumber,
      pageNum,
      pageSize,
    },
  )
  return unwrapApiResponse(response.data) ?? { items: [], totalItemsCount: 0 }
}

export async function fetchDeviceDetailedInfo(deviceNumber: string): Promise<DeviceInfoDetails> {
  const response = await api.get<ApiResponse<DeviceInfoDetails>>(
    `/plugins/deviceinfo/deviceinfo/private/${encodeURIComponent(deviceNumber)}`,
  )
  return unwrapApiResponse(response.data) ?? {}
}

export async function fetchDeviceInventory(deviceNumber: string): Promise<DeviceInventoryView> {
  const response = await api.get<ApiResponse<DeviceInventoryView>>(
    `/plugins/deviceinventory/private/${encodeURIComponent(deviceNumber)}`,
  )
  return unwrapApiResponse(response.data) ?? { applications: [] }
}

export async function requestDeviceInventoryScan(deviceNumber: string): Promise<void> {
  const response = await api.get<ApiResponse<unknown>>(
    `/plugins/deviceinventory/private/scan/${encodeURIComponent(deviceNumber)}`,
  )
  unwrapApiResponse(response.data)
}

export async function fetchDeviceLocation(deviceNumber: string): Promise<DeviceLocationView> {
  const response = await api.get<ApiResponse<DeviceLocationView>>(
    `/plugins/devicelocation/private/${encodeURIComponent(deviceNumber)}`,
  )
  return unwrapApiResponse(response.data) ?? {}
}

export async function fetchDeviceResetStatus(deviceId: number): Promise<DeviceResetStatus> {
  const response = await api.get<ApiResponse<DeviceResetStatus>>(
    `/plugins/devicereset/private/status/${deviceId}`,
  )
  return unwrapApiResponse(response.data) ?? {}
}

export async function requestDeviceLock(deviceId: number, lockMessage?: string): Promise<void> {
  const response = await api.put<ApiResponse<unknown>>('/plugins/devicereset/private/lock', {
    deviceId,
    lockMessage,
  })
  unwrapApiResponse(response.data)
}

export async function requestDeviceUnlock(deviceId: number): Promise<void> {
  const response = await api.put<ApiResponse<unknown>>('/plugins/devicereset/private/unlock', {
    deviceId,
  })
  unwrapApiResponse(response.data)
}
