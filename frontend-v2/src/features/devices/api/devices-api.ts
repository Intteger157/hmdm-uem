import { api } from '@/shared/api/client'
import { isMockApiEnabled } from '@/shared/api/mock-utils'
import { mockGetDeviceById, mockSearchDevices } from '@/shared/api/mocks/devices'
import type { ApiResponse } from '@/shared/api/types/api-response'
import { unwrapApiResponse } from '@/shared/api/types/api-response'
import type {
  DeviceListView,
  DeviceSearchParams,
  DeviceSearchRequest,
  DeviceView,
} from '@/shared/api/types/device'

function normalizeDeviceListView(raw: DeviceListView): DeviceListView {
  const items = raw.devices.items.map(
    (device): DeviceView => ({
      ...device,
      platform: device.platform ?? 'android',
    }),
  )

  return {
    ...raw,
    devices: {
      ...raw.devices,
      items,
    },
  }
}

export async function searchDevices(params: DeviceSearchParams): Promise<DeviceListView> {
  if (isMockApiEnabled()) {
    return mockSearchDevices(params)
  }

  const body: DeviceSearchRequest = {
    pageNum: params.pageNum,
    pageSize: params.pageSize,
    sortBy: params.sortBy ?? 'LAST_UPDATE',
    sortDir: params.sortDir ?? 'DESC',
  }

  if (params.value?.trim()) {
    body.value = params.value.trim()
  }

  const response = await api.post<ApiResponse<DeviceListView>>('/private/devices/search', body)
  return normalizeDeviceListView(unwrapApiResponse(response.data))
}

export async function getDeviceById(id: number): Promise<DeviceView> {
  if (isMockApiEnabled()) {
    const device = await mockGetDeviceById(id)
    if (!device) {
      throw new Error('Device not found')
    }
    return device
  }

  throw new Error('getDeviceById is not implemented for live API yet')
}

export function getConfigurationName(
  configurations: DeviceListView['configurations'],
  configurationId: number,
): string {
  return configurations[String(configurationId)]?.name ?? `#${configurationId}`
}
