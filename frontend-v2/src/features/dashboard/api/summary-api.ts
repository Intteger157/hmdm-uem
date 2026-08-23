import axios from 'axios'
import { api } from '@/shared/api/client'
import { WINDOWS_API_BASE } from '@/shared/api/config'
import { setupAuthInterceptors } from '@/shared/api/setup-auth-interceptors'
import { isMockApiEnabled } from '@/shared/api/mock-utils'
import { mockFetchDeviceSummary } from '@/shared/api/mocks/summary'
import type { ApiResponse } from '@/shared/api/types/api-response'
import { unwrapApiResponse } from '@/shared/api/types/api-response'
import type { SummaryFetchResult, SummaryResponse } from '@/shared/api/types/summary'
import { searchWindowsDevices } from '@/features/windows/api/windows-api'
import { resolveDeviceOnlineStatusCode } from '@/features/devices/utils/device-online-status'
import type { AttentionDeviceRow, AttentionSeverity } from '@/features/dashboard/lib/dashboard-attention'
import type { DeviceOnlineStatusCode } from '@/features/devices/utils/device-online-status'
import type { Platform } from '@/shared/api/types/platform'

const windowsApi = axios.create({
  baseURL: WINDOWS_API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
})

setupAuthInterceptors(windowsApi)

interface DashboardAttentionDeviceDto {
  platform: Platform
  number: string
  displayName: string
  statusCode: DeviceOnlineStatusCode
  lastUpdate?: number
  configurationName?: string
}

interface DashboardAttentionDevicesDto {
  items: DashboardAttentionDeviceDto[]
  warnings?: string[]
}

async function fetchWindowsDeviceSummary(): Promise<SummaryResponse> {
  const list = await searchWindowsDevices({ platform: 'windows', pageNum: 1, pageSize: 200 })
  const now = Date.now()
  const statusCounts = { green: 0, yellow: 0, red: 0, grey: 0, brown: 0 }

  for (const device of list.devices.items) {
    const status = resolveDeviceOnlineStatusCode(device, now)
    statusCounts[status] += 1
  }

  const total = list.devices.totalItemsCount

  return {
    devicesTotal: total,
    devicesEnrolled: total - statusCounts.brown,
    devicesEnrolledLastMonth: 0,
    statusSummary: [
      { stringAttr: 'green', intAttr: 0, number: statusCounts.green },
      { stringAttr: 'yellow', intAttr: 0, number: statusCounts.yellow },
      { stringAttr: 'red', intAttr: 0, number: statusCounts.red },
      { stringAttr: 'grey', intAttr: 0, number: statusCounts.grey },
      { stringAttr: 'brown', intAttr: 0, number: statusCounts.brown },
    ],
    installSummary: [],
    devicesEnrolledMonthly: [],
    topConfigs: [],
    statusOfflineByConfig: [],
    statusIdleByConfig: [],
    statusOnlineByConfig: [],
    appFailureByConfig: [],
    appMismatchByConfig: [],
    appSuccessByConfig: [],
  }
}

async function fetchJavaAndroidSummary(): Promise<SummaryResponse> {
  const response = await api.get<ApiResponse<SummaryResponse>>('/private/summary/devices')
  return unwrapApiResponse(response.data)
}

async function fetchUnifiedGoSummary(platform: Platform): Promise<SummaryResponse> {
  const response = await windowsApi.get<SummaryResponse>('/dashboard/summary', {
    params: { platform },
  })
  return response.data
}

async function fetchPlatformFallbackSummary(platform: Platform): Promise<SummaryFetchResult> {
  const warnings: string[] = []

  if (platform === 'android') {
    try {
      return { summary: await fetchJavaAndroidSummary(), warnings }
    } catch {
      warnings.push('Android fleet metrics are temporarily unavailable.')
      throw new Error('dashboard summary unavailable')
    }
  }

  try {
    return { summary: await fetchWindowsDeviceSummary(), warnings }
  } catch {
    warnings.push('Windows fleet metrics are temporarily unavailable.')
    throw new Error('dashboard summary unavailable')
  }
}

export async function fetchDeviceSummary(platform: Platform): Promise<SummaryFetchResult> {
  if (isMockApiEnabled()) {
    return { summary: await mockFetchDeviceSummary(), warnings: [] }
  }

  try {
    const summary = await fetchUnifiedGoSummary(platform)
    return {
      summary,
      warnings: summary.warnings ?? [],
    }
  } catch {
    return fetchPlatformFallbackSummary(platform)
  }
}

function attentionSeverity(status: DeviceOnlineStatusCode): AttentionSeverity {
  if (status === 'brown' || status === 'red') {
    return 'critical'
  }
  if (status === 'yellow') {
    return 'warning'
  }
  return 'info'
}

function attentionIssueKey(status: DeviceOnlineStatusCode): string {
  switch (status) {
    case 'red':
      return 'dashboard.attention.issue.offline'
    case 'yellow':
      return 'dashboard.attention.issue.idle'
    case 'brown':
      return 'dashboard.attention.issue.agentRemoved'
    case 'grey':
      return 'dashboard.attention.issue.noSignal'
    default:
      return 'dashboard.attention.issue.unknown'
  }
}

function mapAttentionDevice(item: DashboardAttentionDeviceDto): AttentionDeviceRow {
  return {
    device: {
      id: 0,
      platform: item.platform,
      number: item.number,
      description: item.platform === 'android' ? item.displayName : undefined,
      hostname: item.platform === 'windows' ? item.displayName : undefined,
      model: item.platform === 'windows' ? item.displayName : undefined,
      configurationId: 0,
      configurationName: item.configurationName,
      lastUpdate: item.lastUpdate,
      statusCode: item.statusCode,
      windowsAgentStatus: item.statusCode === 'brown' ? 'uninstalled' : 'active',
    },
    status: item.statusCode,
    severity: attentionSeverity(item.statusCode),
    issueKey: attentionIssueKey(item.statusCode),
    lastSeenMs: item.lastUpdate,
  }
}

export async function fetchDashboardAttentionDevices(
  limit = 5,
  platform: Platform,
): Promise<{
  devices: AttentionDeviceRow[]
  warnings: string[]
}> {
  if (isMockApiEnabled()) {
    return { devices: [], warnings: [] }
  }

  try {
    const response = await windowsApi.get<DashboardAttentionDevicesDto>('/dashboard/attention-devices', {
      params: { limit, platform },
    })
    return {
      devices: response.data.items.map(mapAttentionDevice),
      warnings: response.data.warnings ?? [],
    }
  } catch {
    return { devices: [], warnings: ['Attention device list is temporarily unavailable.'] }
  }
}
