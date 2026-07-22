import { api } from '@/shared/api/client'
import type { ApiResponse } from '@/shared/api/types/api-response'
import { unwrapApiResponse } from '@/shared/api/types/api-response'

/** Full configuration entity from Java backend (subset of fields we render/edit). */
export interface Configuration {
  id?: number
  name: string
  description?: string
  qrCodeKey?: string
  baseUrl?: string
  type?: number
  password?: string
  mainAppId?: number
  eventReceivingComponent?: string
  kioskMode?: boolean
  wifiSSID?: string
  wifiPassword?: string
  gps?: boolean
  bluetooth?: boolean
  wifi?: boolean
  mobileData?: boolean
  usbStorage?: boolean
  blockStatusBar?: boolean
  systemUpdateType?: number
  /** Backend returns many more fields; keep them to send back unchanged on save. */
  [key: string]: unknown
}

export interface ConfigurationCopyRequest {
  id: number
  name: string
  description?: string
}

export async function fetchConfigurations(): Promise<Configuration[]> {
  const response = await api.get<ApiResponse<Configuration[]>>('/private/configurations/search')
  return unwrapApiResponse(response.data)
}

export async function fetchConfigurationById(id: number): Promise<Configuration> {
  const response = await api.get<ApiResponse<Configuration>>(`/private/configurations/${id}`)
  return unwrapApiResponse(response.data)
}

export async function upsertConfiguration(configuration: Configuration): Promise<void> {
  const response = await api.put<ApiResponse<unknown>>('/private/configurations', configuration)
  unwrapApiResponse(response.data)
}

export async function copyConfiguration(request: ConfigurationCopyRequest): Promise<void> {
  const response = await api.put<ApiResponse<unknown>>('/private/configurations/copy', request)
  unwrapApiResponse(response.data)
}

export async function deleteConfiguration(id: number): Promise<void> {
  const response = await api.delete<ApiResponse<unknown>>(`/private/configurations/${id}`)
  unwrapApiResponse(response.data)
}
