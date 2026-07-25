import axios from 'axios'

/** Raw API payload (snake_case from Go public endpoint). */
interface PublicDeviceInfoDto {
  device_id?: string
  deviceId?: string
  hostname?: string
  manufacturer?: string
  model?: string
  mdm_server?: string
  mdmServer?: string
  agent_version?: string
  agentVersion?: string
  last_sync?: string
  lastSyncTime?: string
}

export interface PublicDeviceInfo {
  deviceId?: string
  hostname?: string
  manufacturer?: string
  model?: string
  mdmServer?: string
  agentVersion?: string
  lastSyncTime?: string
}

function normalizePublicDeviceInfo(raw: PublicDeviceInfoDto): PublicDeviceInfo {
  return {
    deviceId: raw.device_id?.trim() || raw.deviceId?.trim(),
    hostname: raw.hostname,
    manufacturer: raw.manufacturer,
    model: raw.model,
    mdmServer: raw.mdm_server?.trim() || raw.mdmServer?.trim(),
    agentVersion: raw.agent_version?.trim() || raw.agentVersion?.trim(),
    lastSyncTime: raw.last_sync?.trim() || raw.lastSyncTime?.trim(),
  }
}

export async function fetchPublicDeviceInfo(deviceId: string): Promise<PublicDeviceInfo> {
  const response = await axios.get<PublicDeviceInfoDto>(
    `/api/public/device-info/${encodeURIComponent(deviceId)}`,
  )
  return normalizePublicDeviceInfo(response.data)
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
