import { api } from '@/shared/api/client'
import type { ApiResponse } from '@/shared/api/types/api-response'
import { unwrapApiResponse } from '@/shared/api/types/api-response'

export interface DeviceRemoteSettings {
  serverUrl?: string
  serverSecret?: string
}

export interface DeviceRemoteStatus {
  status?: string
  agentStatus?: string
  sessionId?: string
  password?: string
  viewerUrl?: string
  serverUrl?: string
  requestedAt?: number
  updatedAt?: number
}

export async function fetchDeviceRemoteSettings(): Promise<DeviceRemoteSettings> {
  const response = await api.get<ApiResponse<DeviceRemoteSettings>>(
    '/plugins/deviceremote/private/settings'
  )
  return unwrapApiResponse(response.data)
}

export async function updateDeviceRemoteSettings(
  settings: DeviceRemoteSettings
): Promise<void> {
  const response = await api.put<ApiResponse<unknown>>(
    '/plugins/deviceremote/private/settings',
    settings
  )
  unwrapApiResponse(response.data)
}

export async function fetchDeviceRemoteStatus(deviceId: number): Promise<DeviceRemoteStatus> {
  const response = await api.get<ApiResponse<DeviceRemoteStatus>>(
    `/plugins/deviceremote/private/status/${deviceId}`
  )
  return unwrapApiResponse(response.data)
}

export async function startDeviceRemoteSession(deviceId: number): Promise<DeviceRemoteStatus> {
  const response = await api.put<ApiResponse<DeviceRemoteStatus>>(
    '/plugins/deviceremote/private/start',
    { deviceId }
  )
  return unwrapApiResponse(response.data)
}

export async function stopDeviceRemoteSession(deviceId: number): Promise<DeviceRemoteStatus> {
  const response = await api.put<ApiResponse<DeviceRemoteStatus>>(
    '/plugins/deviceremote/private/stop',
    { deviceId }
  )
  return unwrapApiResponse(response.data)
}

export function buildDeviceRemoteViewerUrl(
  status: DeviceRemoteStatus,
  viewerBaseUrl?: string
): string | null {
  if (status.viewerUrl?.trim()) {
    return status.viewerUrl.trim()
  }
  const base = (viewerBaseUrl ?? status.serverUrl ?? '').trim()
  if (!base || !status.sessionId || !status.password) {
    return null
  }
  const normalized = base.endsWith('/') ? base : `${base}/`
  return `${normalized}?session=${encodeURIComponent(status.sessionId)}&pin=${encodeURIComponent(status.password)}`
}
