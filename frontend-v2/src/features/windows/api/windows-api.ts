import axios from 'axios'
import { API_BASE } from '@/shared/api/config'
import { isMockApiEnabled } from '@/shared/api/mock-utils'
import { mockSearchDevices } from '@/shared/api/mocks/devices'
import type {
  DeviceListView,
  DeviceSearchParams,
  DeviceView,
} from '@/shared/api/types/device'
import type { InstalledSoftware, LocalUser } from '@/shared/api/types/device-detail'

/** Go server-windows list item (GET /rest/windows/devices). */
export interface WindowsDeviceDto {
  id: number
  hardwareId: string
  hostname: string
  osVersion: string
  cpu: string
  ramGb: number
  diskTotalGb: number
  diskUsedGb: number
  manufacturer?: string
  model?: string
  serialNumber?: string
  currentUser?: string
  diskEncrypted?: boolean
  localUsers?: LocalUser[]
  installedSoftware?: InstalledSoftware[]
  lastCheckin: string
}

export interface WindowsDeviceListDto {
  items: WindowsDeviceDto[]
  totalItemsCount: number
}

const windowsApi = axios.create({
  baseURL: `${API_BASE}/windows`,
  headers: {
    'Content-Type': 'application/json',
  },
})

function mapWindowsDeviceToView(raw: WindowsDeviceDto): DeviceView {
  const lastUpdate = raw.lastCheckin ? Date.parse(raw.lastCheckin) : undefined
  const modelLabel =
    raw.manufacturer && raw.model
      ? `${raw.manufacturer} ${raw.model}`
      : raw.model || raw.manufacturer || undefined

  return {
    id: raw.id,
    platform: 'windows',
    configurationId: 0,
    number: raw.hardwareId,
    hostname: raw.hostname || raw.hardwareId,
    description: modelLabel,
    manufacturer: raw.manufacturer || undefined,
    model: raw.model || undefined,
    serialNumber: raw.serialNumber || undefined,
    serial: raw.serialNumber || undefined,
    currentUser: raw.currentUser || undefined,
    windowsBuild: raw.osVersion || undefined,
    cpu: raw.cpu || undefined,
    ramGb: raw.ramGb || undefined,
    diskTotalGb: raw.diskTotalGb || undefined,
    diskUsedGb: raw.diskUsedGb || undefined,
    diskEncrypted: raw.diskEncrypted,
    bitlockerStatus: raw.diskEncrypted ? 'on' : raw.diskEncrypted === false ? 'off' : 'unknown',
    powershellExecStatus: 'idle',
    localUsers: raw.localUsers ?? [],
    installedSoftware: raw.installedSoftware ?? [],
    lastUpdate: Number.isFinite(lastUpdate) ? lastUpdate : undefined,
  }
}

function toDeviceListView(raw: WindowsDeviceListDto): DeviceListView {
  return {
    configurations: {},
    devices: {
      items: raw.items.map(mapWindowsDeviceToView),
      totalItemsCount: raw.totalItemsCount,
    },
  }
}

/** Lists Windows agents from Go server-windows (never hits Java /private/devices). */
export async function searchWindowsDevices(params: DeviceSearchParams): Promise<DeviceListView> {
  if (isMockApiEnabled()) {
    return mockSearchDevices(params)
  }

  const query = new URLSearchParams({
    pageNum: String(params.pageNum),
    pageSize: String(params.pageSize),
  })

  if (params.value?.trim()) {
    query.set('value', params.value.trim())
  }

  const response = await windowsApi.get<WindowsDeviceListDto>(`/devices?${query.toString()}`)
  return toDeviceListView(response.data)
}

/** Fetches one Windows agent by hardware ID (UUID). */
export async function getWindowsDeviceByHardwareId(hardwareId: string): Promise<DeviceView> {
  if (isMockApiEnabled()) {
    const list = await mockSearchDevices({ platform: 'windows', pageNum: 1, pageSize: 100 })
    const device = list.devices.items.find(
      (item) => item.number === hardwareId || String(item.id) === hardwareId,
    )
    if (!device) {
      throw new Error('Device not found')
    }
    return device
  }

  const encoded = encodeURIComponent(hardwareId)
  const response = await windowsApi.get<WindowsDeviceDto>(`/devices/${encoded}`)
  return mapWindowsDeviceToView(response.data)
}

export type WindowsCommandAction =
  | 'sync'
  | 'restart'
  | 'lock'
  | 'bitlocker_enable'
  | 'powershell'
  | 'install'
  | 'wipe'

export interface WindowsCommandPayload {
  script?: string
  url?: string
}

interface EnqueueCommandResponse {
  id: number
  action: string
  status: string
}

/** Queues a remote command for a Windows agent (picked up on next poll). */
export async function sendWindowsDeviceCommand(
  hardwareId: string,
  action: WindowsCommandAction,
  payload?: WindowsCommandPayload,
): Promise<EnqueueCommandResponse> {
  if (isMockApiEnabled()) {
    return { id: Date.now(), action, status: 'pending' }
  }

  const encoded = encodeURIComponent(hardwareId)
  const response = await windowsApi.post<EnqueueCommandResponse>(
    `/devices/${encoded}/commands`,
    {
      action,
      payload: payload ?? {},
    },
  )
  return response.data
}
