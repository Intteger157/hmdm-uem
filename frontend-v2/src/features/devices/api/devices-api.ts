import { api, publicApi } from '@/shared/api/client'
import { isMockApiEnabled, mockNetworkDelay } from '@/shared/api/mock-utils'
import { mockGetDeviceById, mockSearchDevices } from '@/shared/api/mocks/devices'
import type { ApiResponse } from '@/shared/api/types/api-response'
import { unwrapApiResponse } from '@/shared/api/types/api-response'
import type {
  DeviceListView,
  DeviceSearchParams,
  DeviceSearchRequest,
  DeviceUpsertPayload,
  DeviceView,
  LookupItem,
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

export function getConfigurationQrCodeKey(
  configurations: DeviceListView['configurations'],
  configurationId: number,
): string | undefined {
  return configurations[String(configurationId)]?.qrCodeKey
}

export async function fetchConfigurationOptions(): Promise<LookupItem[]> {
  if (isMockApiEnabled()) {
    return Object.values(
      (await mockSearchDevices({ platform: 'android', pageNum: 1, pageSize: 1 })).configurations,
    ).map((c) => ({ id: c.id, name: c.name }))
  }

  const response = await api.get<ApiResponse<LookupItem[]>>('/private/configurations/list')
  return unwrapApiResponse(response.data)
}

export async function fetchGroupOptions(): Promise<LookupItem[]> {
  if (isMockApiEnabled()) {
    await mockNetworkDelay()
    return [
      { id: 1, name: 'Retail' },
      { id: 2, name: 'Sales' },
      { id: 3, name: 'Warehouse' },
    ]
  }

  const response = await api.get<ApiResponse<LookupItem[]>>('/private/groups/search')
  return unwrapApiResponse(response.data).map((g) => ({
    id: g.id,
    name: g.name,
  }))
}

export async function upsertDevice(payload: DeviceUpsertPayload): Promise<void> {
  if (isMockApiEnabled()) {
    await mockNetworkDelay()
    return
  }

  const body: DeviceUpsertPayload = {
    ...payload,
    groups: payload.groups?.map((g) => ({ id: g.id, name: g.name ?? '' })),
  }

  const response = await api.put<ApiResponse<unknown>>('/private/devices', body)
  unwrapApiResponse(response.data)
}

export async function deleteDevice(id: number): Promise<void> {
  if (isMockApiEnabled()) {
    await mockNetworkDelay()
    return
  }

  const response = await api.delete<ApiResponse<unknown>>(`/private/devices/${id}`)
  unwrapApiResponse(response.data)
}

/** Public QR PNG for device enrollment (same as legacy UI). */
export async function fetchDeviceQrCodeBlob(
  qrCodeKey: string,
  deviceId: string,
  size = 280,
): Promise<Blob> {
  if (isMockApiEnabled()) {
    await mockNetworkDelay()
    const base64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i)
    }
    return new Blob([bytes], { type: 'image/png' })
  }

  const response = await publicApi.get<Blob>(`/public/qr/${encodeURIComponent(qrCodeKey)}`, {
    params: {
      deviceId,
      size,
    },
    responseType: 'blob',
  })

  const blob = response.data
  if (!(blob instanceof Blob) || blob.size === 0) {
    throw new Error('QR code image is empty')
  }

  return blob
}
