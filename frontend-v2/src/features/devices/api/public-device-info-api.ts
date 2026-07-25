import axios from 'axios'

export interface PublicDeviceInfo {
  deviceId?: string
  hostname?: string
  manufacturer?: string
  model?: string
  mdmServer?: string
  agentVersion?: string
  lastSyncTime?: string
}

export async function fetchPublicDeviceInfo(deviceId: string): Promise<PublicDeviceInfo> {
  const response = await axios.get<PublicDeviceInfo>(
    `/api/public/device-info/${encodeURIComponent(deviceId)}`,
  )
  return response.data
}

export function formatPublicLastSync(value?: string | null): string {
  const trimmed = value?.trim() ?? ''
  if (!trimmed) {
    return '—'
  }

  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) {
    return trimmed
  }

  return parsed.toLocaleString()
}

export function formatPublicManufacturerModel(
  manufacturer?: string | null,
  model?: string | null,
  unknownLabel = '—',
): string {
  const hardwareInfo = [manufacturer, model]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(' ')

  return hardwareInfo || unknownLabel
}
