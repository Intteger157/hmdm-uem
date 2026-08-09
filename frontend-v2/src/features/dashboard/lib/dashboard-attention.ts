import { resolveDeviceOnlineStatusCode } from '@/features/devices/utils/device-online-status'
import type { DeviceView } from '@/shared/api/types/device'
import type { DeviceOnlineStatusCode } from '@/features/devices/utils/device-online-status'

export type AttentionSeverity = 'critical' | 'warning' | 'info'

export interface AttentionDeviceRow {
  device: DeviceView
  status: DeviceOnlineStatusCode
  severity: AttentionSeverity
  issueKey: string
  lastSeenMs?: number
}

const STATUS_RANK: Record<DeviceOnlineStatusCode, number> = {
  brown: 100,
  red: 90,
  grey: 70,
  yellow: 50,
  green: 0,
}

export function deviceDisplayName(device: DeviceView): string {
  if (device.platform === 'windows') {
    return device.hostname?.trim() || device.model?.trim() || device.number
  }
  return device.description?.trim() || device.number
}

export function rankAttentionDevices(
  devices: DeviceView[],
  now = Date.now(),
  limit = 5,
): AttentionDeviceRow[] {
  const rows: AttentionDeviceRow[] = []

  for (const device of devices) {
    const status = resolveDeviceOnlineStatusCode(device, now)
    if (status === 'green') {
      continue
    }

    const severity: AttentionSeverity =
      status === 'brown' || status === 'red'
        ? 'critical'
        : status === 'yellow'
          ? 'warning'
          : 'info'

    let issueKey = 'dashboard.attention.issue.unknown'
    if (status === 'red') {
      issueKey = 'dashboard.attention.issue.offline'
    } else if (status === 'yellow') {
      issueKey = 'dashboard.attention.issue.idle'
    } else if (status === 'brown') {
      issueKey = 'dashboard.attention.issue.agentRemoved'
    } else if (status === 'grey') {
      issueKey = 'dashboard.attention.issue.noSignal'
    }

    rows.push({
      device,
      status,
      severity,
      issueKey,
      lastSeenMs: device.lastUpdate,
    })
  }

  return rows
    .sort((a, b) => STATUS_RANK[b.status] - STATUS_RANK[a.status])
    .slice(0, limit)
}
