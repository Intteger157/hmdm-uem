import axios from 'axios'
import { api } from '@/shared/api/client'
import { isMockApiEnabled } from '@/shared/api/mock-utils'
import { mockFetchDeviceSummary } from '@/shared/api/mocks/summary'
import type { ApiResponse } from '@/shared/api/types/api-response'
import { unwrapApiResponse } from '@/shared/api/types/api-response'
import type { SummaryResponse } from '@/shared/api/types/summary'
import { searchWindowsDevices } from '@/features/windows/api/windows-api'
import { resolveDeviceOnlineStatusCode } from '@/features/devices/utils/device-online-status'

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
      {
        stringAttr: 'red',
        intAttr: 0,
        number: statusCounts.red + statusCounts.grey + statusCounts.brown,
      },
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

export async function fetchDeviceSummary(): Promise<SummaryResponse> {
  if (isMockApiEnabled()) {
    return mockFetchDeviceSummary()
  }

  try {
    const response = await api.get<ApiResponse<SummaryResponse>>('/private/summary/devices')
    return unwrapApiResponse(response.data)
  } catch (err) {
    if (
      axios.isAxiosError(err) &&
      (err.response?.status === 401 || err.response?.status === 403)
    ) {
      return fetchWindowsDeviceSummary()
    }
    throw err
  }
}
