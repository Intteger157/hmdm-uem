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

function normalizePublicDeviceInfo(raw: unknown): PublicDeviceInfo {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Invalid device info response payload')
  }

  const dto = raw as PublicDeviceInfoDto
  const normalized: PublicDeviceInfo = {
    deviceId: dto.device_id?.trim() || dto.deviceId?.trim(),
    hostname: dto.hostname,
    manufacturer: dto.manufacturer,
    model: dto.model,
    mdmServer: dto.mdm_server?.trim() || dto.mdmServer?.trim(),
    agentVersion: dto.agent_version?.trim() || dto.agentVersion?.trim(),
    lastSyncTime: dto.last_sync?.trim() || dto.lastSyncTime?.trim(),
  }

  const hasPayload = Boolean(
    normalized.hostname?.trim() ||
      normalized.manufacturer?.trim() ||
      normalized.model?.trim() ||
      normalized.mdmServer?.trim() ||
      normalized.agentVersion?.trim() ||
      normalized.lastSyncTime?.trim(),
  )
  if (!hasPayload) {
    throw new Error('Device info API returned an empty payload')
  }

  return normalized
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
