import axios from 'axios'

export interface PublicDeviceInfo {
  deviceId: string
  hostname: string
  mdmServer: string
  agentVersion: string
  lastSyncTime: string
}

export async function fetchPublicDeviceInfo(deviceId: string): Promise<PublicDeviceInfo> {
  const response = await axios.get<PublicDeviceInfo>(
    `/api/public/device-info/${encodeURIComponent(deviceId)}`,
  )
  return response.data
}

export function formatPublicLastSync(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) {
    return '—'
  }

  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) {
    return trimmed
  }

  return parsed.toLocaleString()
}
