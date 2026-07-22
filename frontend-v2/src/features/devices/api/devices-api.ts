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
import type { InstalledSoftware } from '@/shared/api/types/device-detail'

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

function normalizeDeviceView(raw: DeviceView): DeviceView {
  const platform = raw.platform ?? 'android'
  const info = raw.info

  const installedSoftware: InstalledSoftware[] | undefined =
    raw.installedSoftware ??
    info?.applications?.map((app) => ({
      name: app.name ?? app.pkg,
      version: app.version ?? '—',
      publisher: app.pkg,
      installDate: '—',
    }))

  return {
    ...raw,
    platform,
    androidVersion: raw.androidVersion ?? info?.androidVersion,
    imei: raw.imei ?? info?.imei,
    phone: raw.phone ?? info?.phone,
    serial: raw.serial ?? info?.serial,
    mdmMode: raw.mdmMode ?? info?.mdmMode,
    kioskMode: raw.kioskMode ?? info?.kioskMode,
    serialNumber: raw.serialNumber ?? raw.serial ?? info?.serial,
    model: raw.model ?? info?.model,
    installedSoftware,
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

export async function getDeviceByNumber(number: string): Promise<DeviceView> {
  if (isMockApiEnabled()) {
    const list = await mockSearchDevices({ platform: 'android', pageNum: 1, pageSize: 100 })
    const device = list.devices.items.find(
      (d) => d.number === number || String(d.id) === number,
    )
    if (!device) {
      throw new Error('Device not found')
    }
    return device
  }

  const encoded = encodeURIComponent(number)
  const response = await api.get<ApiResponse<DeviceView>>(`/private/devices/number/${encoded}`)
  return normalizeDeviceView(unwrapApiResponse(response.data))
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
