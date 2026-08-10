import axios from 'axios'
import { api } from '@/shared/api/client'
import { WINDOWS_API_BASE } from '@/shared/api/config'
import { setupAuthInterceptors } from '@/shared/api/setup-auth-interceptors'
import { isMockApiEnabled } from '@/shared/api/mock-utils'
import { mockFetchDeviceSummary } from '@/shared/api/mocks/summary'
import type { ApiResponse } from '@/shared/api/types/api-response'
import { unwrapApiResponse } from '@/shared/api/types/api-response'
import type { ChartItem, SummaryFetchResult, SummaryResponse } from '@/shared/api/types/summary'
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

function emptySummary(): SummaryResponse {
  return {
    devicesTotal: 0,
    devicesEnrolled: 0,
    devicesEnrolledLastMonth: 0,
    statusSummary: [],
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

async function fetchUnifiedGoSummary(): Promise<SummaryResponse> {
  const response = await windowsApi.get<SummaryResponse>('/dashboard/summary')
  return response.data
}

function mergeChartItems(...groups: ChartItem[][]): ChartItem[] {
  const totals = new Map<string, number>()
  for (const group of groups) {
    for (const item of group) {
      const key = item.stringAttr
      totals.set(key, (totals.get(key) ?? 0) + item.number)
    }
  }
  return Array.from(totals.entries()).map(([stringAttr, number]) => ({
    stringAttr,
    intAttr: 0,
    number,
  }))
}

function mergeSummaries(
  android: SummaryResponse | null,
  windows: SummaryResponse | null,
): SummaryResponse {
  if (!android && !windows) {
    return emptySummary()
  }
  if (!android) {
    return windows as SummaryResponse
  }
  if (!windows) {
    return android
  }

  return {
    devicesTotal: android.devicesTotal + windows.devicesTotal,
    devicesEnrolled: android.devicesEnrolled + windows.devicesEnrolled,
    devicesEnrolledLastMonth: android.devicesEnrolledLastMonth + windows.devicesEnrolledLastMonth,
    statusSummary: mergeChartItems(android.statusSummary, windows.statusSummary),
    installSummary: mergeChartItems(android.installSummary, windows.installSummary),
    devicesEnrolledMonthly:
      android.devicesEnrolledMonthly.length > 0
        ? android.devicesEnrolledMonthly
        : windows.devicesEnrolledMonthly,
    topConfigs: android.topConfigs.length > 0 ? android.topConfigs : windows.topConfigs,
    statusOfflineByConfig: android.statusOfflineByConfig,
    statusIdleByConfig: android.statusIdleByConfig,
    statusOnlineByConfig: android.statusOnlineByConfig,
    appFailureByConfig: android.appFailureByConfig,
    appMismatchByConfig: android.appMismatchByConfig,
    appSuccessByConfig: android.appSuccessByConfig,
  }
}

async function fetchMergedFallbackSummary(): Promise<SummaryFetchResult> {
  const warnings: string[] = []
  let android: SummaryResponse | null = null
  let windows: SummaryResponse | null = null

  try {
    android = await fetchJavaAndroidSummary()
  } catch {
    warnings.push('Android fleet metrics are temporarily unavailable.')
  }

  try {
    windows = await fetchWindowsDeviceSummary()
  } catch {
    warnings.push('Windows fleet metrics are temporarily unavailable.')
  }

  if (!android && !windows) {
    throw new Error('dashboard summary unavailable')
  }

  return {
    summary: mergeSummaries(android, windows),
    warnings,
  }
}

export async function fetchDeviceSummary(): Promise<SummaryFetchResult> {
  if (isMockApiEnabled()) {
    return { summary: await mockFetchDeviceSummary(), warnings: [] }
  }

  try {
    const summary = await fetchUnifiedGoSummary()
    return {
      summary,
      warnings: summary.warnings ?? [],
    }
  } catch {
    return fetchMergedFallbackSummary()
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

export async function fetchDashboardAttentionDevices(limit = 5): Promise<{
  devices: AttentionDeviceRow[]
  warnings: string[]
}> {
  if (isMockApiEnabled()) {
    return { devices: [], warnings: [] }
  }

  try {
    const response = await windowsApi.get<DashboardAttentionDevicesDto>('/dashboard/attention-devices', {
      params: { limit },
    })
    return {
      devices: response.data.items.map(mapAttentionDevice),
      warnings: response.data.warnings ?? [],
    }
  } catch {
    return { devices: [], warnings: ['Attention device list is temporarily unavailable.'] }
  }
}
