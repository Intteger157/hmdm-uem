import axios from 'axios'
import { API_BASE } from '@/shared/api/config'
import { isMockApiEnabled } from '@/shared/api/mock-utils'
import { mockSearchDevices } from '@/shared/api/mocks/devices'
import type {
  DeviceListView,
  DeviceSearchParams,
  DeviceView,
  BitLockerStatus,
} from '@/shared/api/types/device'
import type {
  DeviceDiskVolume,
  InstalledSoftware,
  LocalUser,
  WindowsEncryptionStatus,
  WindowsService,
  WindowsUpdateItem,
} from '@/shared/api/types/device-detail'

/** Go server-windows list item (GET /rest/windows/devices). */
export interface WindowsDeviceDto {
  id: number
  hardwareId: string
  hostname: string
  osVersion: string
  cpu: string
  cpuCores?: number
  cpuThreads?: number
  cpuFrequencyGhz?: number
  ramGb: number
  diskTotalGb: number
  diskUsedGb: number
  manufacturer?: string
  model?: string
  serialNumber?: string
  currentUser?: string
  diskEncrypted?: boolean
  encryptionStatus?: WindowsEncryptionStatus
  disks?: DeviceDiskVolume[]
  localUsers?: LocalUser[]
  installedSoftware?: InstalledSoftware[]
  uptimeSeconds?: number
  antivirusName?: string
  antivirusActive?: boolean
  antivirusDefinitionsUpdated?: string
  latitude?: number
  longitude?: number
  publicIp?: string
  localIp?: string
  wifiBssid?: string
  pendingUpdates?: number
  lastUpdateCheck?: string
  pendingUpdatesList?: WindowsUpdateItem[]
  installedUpdatesList?: WindowsUpdateItem[]
  bitLockerKey?: string
  batteryLevel?: number | null
  batteryStatus?: string
  lastCheckin: string
  agentStatus?: string
  uninstalledAt?: string
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

function mapWindowsAgentStatus(raw?: string): 'active' | 'uninstalled' {
  return raw === 'uninstalled' ? 'uninstalled' : 'active'
}

function mapWindowsDeviceToView(raw: WindowsDeviceDto): DeviceView {
  const lastUpdate = raw.lastCheckin ? Date.parse(raw.lastCheckin) : undefined
  const uninstalledAt = raw.uninstalledAt ? Date.parse(raw.uninstalledAt) : undefined
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
    windowsAgentStatus: mapWindowsAgentStatus(raw.agentStatus),
    uninstalledAt: Number.isFinite(uninstalledAt) ? uninstalledAt : undefined,
    cpu: raw.cpu || undefined,
    cpuCores: raw.cpuCores ?? undefined,
    cpuThreads: raw.cpuThreads ?? undefined,
    cpuFrequencyGhz: raw.cpuFrequencyGhz ?? undefined,
    ramGb: raw.ramGb || undefined,
    diskTotalGb: raw.diskTotalGb || undefined,
    diskUsedGb: raw.diskUsedGb || undefined,
    diskEncrypted: raw.diskEncrypted,
    encryptionStatus: raw.encryptionStatus,
    disks: raw.disks ?? [],
    bitlockerStatus: mapEncryptionToBitLocker(raw.encryptionStatus, raw.diskEncrypted),
    powershellExecStatus: 'idle',
    localUsers: raw.localUsers ?? [],
    installedSoftware: raw.installedSoftware ?? [],
    uptimeSeconds: raw.uptimeSeconds || undefined,
    antivirusName: raw.antivirusName || undefined,
    antivirusActive: raw.antivirusActive,
    antivirusDefinitionsUpdated: raw.antivirusDefinitionsUpdated || undefined,
    latitude: raw.latitude || undefined,
    longitude: raw.longitude || undefined,
    publicIp: raw.publicIp || undefined,
    localIp: raw.localIp || undefined,
    wifiBssid: raw.wifiBssid || undefined,
    pendingUpdates: raw.pendingUpdates ?? undefined,
    lastUpdateCheck: raw.lastUpdateCheck || undefined,
    pendingUpdatesList: raw.pendingUpdatesList ?? [],
    installedUpdatesList: raw.installedUpdatesList ?? [],
    bitLockerKey: raw.bitLockerKey || undefined,
    batteryLevel: raw.batteryLevel ?? undefined,
    batteryStatus: raw.batteryStatus || undefined,
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

/** Deletes a Windows agent by hardware ID. */
export async function deleteWindowsDevice(hardwareId: string): Promise<void> {
  if (isMockApiEnabled()) {
    return
  }

  const encoded = encodeURIComponent(hardwareId)
  await windowsApi.delete(`/devices/${encoded}`)
}

export type WindowsCommandAction =
  | 'sync'
  | 'restart'
  | 'lock'
  | 'bitlocker_enable'
  | 'powershell'
  | 'install'
  | 'wipe'
  | 'get_services'
  | 'restart_service'

export interface WindowsCommandPayload {
  script?: string
  url?: string
  service_name?: string
}

export interface WindowsDeviceServicesResponse {
  items: WindowsService[]
  updatedAt?: string
}

interface EnqueueCommandResponse {
  id: number
  action: string
  status: string
}

export interface WindowsLatestCommandResponse {
  id: number
  action: string
  status: string
  result?: string
  completedAt?: string
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

/** Returns the latest remote command for a Windows device (status/result feedback). */
export async function getLatestWindowsDeviceCommand(
  hardwareId: string,
): Promise<WindowsLatestCommandResponse> {
  if (isMockApiEnabled()) {
    return { id: Date.now(), action: 'sync', status: 'completed', result: 'inventory uploaded' }
  }

  const encoded = encodeURIComponent(hardwareId)
  const response = await windowsApi.get<WindowsLatestCommandResponse>(
    `/devices/${encoded}/commands/latest`,
  )
  return response.data
}

/** Returns cached Windows services for a device. */
export async function getWindowsDeviceServices(
  hardwareId: string,
): Promise<WindowsDeviceServicesResponse> {
  if (isMockApiEnabled()) {
    return {
      items: [
        { name: 'wuauserv', displayName: 'Windows Update', status: 'running' },
        { name: 'Spooler', displayName: 'Print Spooler', status: 'stopped' },
      ],
    }
  }

  const encoded = encodeURIComponent(hardwareId)
  const response = await windowsApi.get<WindowsDeviceServicesResponse>(
    `/devices/${encoded}/services`,
  )
  return response.data
}

/** Asks the agent to refresh the Windows services list. */
export async function refreshWindowsDeviceServices(
  hardwareId: string,
): Promise<EnqueueCommandResponse> {
  if (isMockApiEnabled()) {
    return { id: Date.now(), action: 'get_services', status: 'pending' }
  }

  const encoded = encodeURIComponent(hardwareId)
  const response = await windowsApi.post<EnqueueCommandResponse>(
    `/devices/${encoded}/services/refresh`,
  )
  return response.data
}

/** Queues a restart command for one Windows service. */
export async function restartWindowsDeviceService(
  hardwareId: string,
  serviceName: string,
): Promise<EnqueueCommandResponse> {
  if (isMockApiEnabled()) {
    return { id: Date.now(), action: 'restart_service', status: 'pending' }
  }

  const encoded = encodeURIComponent(hardwareId)
  const encodedService = encodeURIComponent(serviceName)
  const response = await windowsApi.post<EnqueueCommandResponse>(
    `/devices/${encoded}/services/${encodedService}/restart`,
  )
  return response.data
}

export type WindowsDeviceCommandName = 'UninstallUpdate' | 'powershell' | 'battery_report' | 'install_windows_update'

export interface DeviceCommandLogEntry {
  id: number
  commandName: string
  payload: string
  status: 'Pending' | 'Success' | 'Failed' | 'Downloading' | 'Installing'
  output?: string
  createdAt: string
  executedAt?: string
}

export interface DeviceCommandLogListResponse {
  items: DeviceCommandLogEntry[]
  totalItemsCount: number
}

interface EnqueueDeviceCommandResponse {
  id: number
  commandName: string
  payload: string
  status: string
}

/** Queues a logged remote command (DeviceCommandLog) for a Windows agent. */
export async function queueWindowsDeviceCommand(
  hardwareId: string,
  commandName: WindowsDeviceCommandName,
  payload: string,
): Promise<EnqueueDeviceCommandResponse> {
  if (isMockApiEnabled()) {
    return { id: Date.now(), commandName, payload, status: 'Pending' }
  }

  const encoded = encodeURIComponent(hardwareId)
  const response = await windowsApi.post<EnqueueDeviceCommandResponse>(
    `/devices/${encoded}/commands`,
    { commandName, payload },
  )
  return response.data
}

/** Returns command execution history for a Windows device. */
export async function getWindowsDeviceCommandLogs(
  hardwareId: string,
): Promise<DeviceCommandLogListResponse> {
  if (isMockApiEnabled()) {
    return { items: [], totalItemsCount: 0 }
  }

  const encoded = encodeURIComponent(hardwareId)
  const response = await windowsApi.get<DeviceCommandLogListResponse>(`/devices/${encoded}/logs`)
  return response.data
}

export interface WindowsEnrollmentSetupResponse {
  orgEnrollmentSecret: string
  installerConfigured: boolean
  permanentFileUrl?: string
  buildCommand?: string
}

/** Returns the shared org enrollment secret and universal MSI status (stable across dialog opens). */
export async function getWindowsEnrollmentSetup(): Promise<WindowsEnrollmentSetupResponse> {
  if (isMockApiEnabled()) {
    return {
      orgEnrollmentSecret: 'win-enroll-org-mock-secret',
      installerConfigured: false,
      buildCommand:
        '.\\agent-windows\\installer\\build-msi.ps1 -ServerUrl "https://mdm.example.com" -Token "win-enroll-org-mock-secret"',
    }
  }

  const response = await windowsApi.get<WindowsEnrollmentSetupResponse>('/enrollment-setup')
  return response.data
}

export interface WindowsDefaultInstallerResponse {
  configured: boolean
  filesRelativePath?: string
  fileName?: string
  permanentFileUrl?: string
}

export const DEFAULT_AGENT_MSI_NAME = 'HMDMAgent.msi'
export const DEFAULT_AGENT_MSI_PATH = 'windows/agents/HMDMAgent.msi'

/** @deprecated Use getWindowsEnrollmentSetup — kept for compatibility. */
export async function createWindowsEnrollmentToken(): Promise<WindowsEnrollmentSetupResponse> {
  return getWindowsEnrollmentSetup()
}

export async function getDefaultWindowsInstaller(): Promise<WindowsDefaultInstallerResponse> {
  if (isMockApiEnabled()) {
    return { configured: false }
  }

  const response = await windowsApi.get<WindowsDefaultInstallerResponse>('/installers/default')
  return response.data
}

export async function registerDefaultWindowsInstaller(
  request: Omit<LinkWindowsInstallerRequest, 'enrollmentToken'>,
): Promise<WindowsDefaultInstallerResponse> {
  if (isMockApiEnabled()) {
    return {
      configured: true,
      filesRelativePath: request.filesRelativePath,
      fileName: request.fileName,
      permanentFileUrl: request.permanentFileUrl,
    }
  }

  const response = await windowsApi.post<WindowsDefaultInstallerResponse>('/installers/default', request)
  return response.data
}

export interface LinkWindowsInstallerRequest {
  enrollmentToken: string
  filesRelativePath: string
  fileName: string
  permanentFileUrl: string
}

export interface LinkWindowsInstallerResponse {
  downloadUrl: string
  permanentFileUrl: string
  downloadToken: string
}

/** Links an uploaded MSI (Java Files storage) to an enrollment token and returns a one-time download URL. */
export async function linkWindowsInstaller(
  request: LinkWindowsInstallerRequest,
): Promise<LinkWindowsInstallerResponse> {
  if (isMockApiEnabled()) {
    const downloadToken = `win-dl-mock-${Date.now()}`
    return {
      downloadUrl: `${window.location.origin}/rest/windows/downloads/${downloadToken}`,
      permanentFileUrl: request.permanentFileUrl,
      downloadToken,
    }
  }

  const response = await windowsApi.post<LinkWindowsInstallerResponse>('/installers/link', request)
  return response.data
}

/** Extracts the storage path after `/files/` from a public file URL. */
export function filesRelativePathFromUrl(fileUrl: string): string {
  const pathname = new URL(fileUrl).pathname.replace(/^\/+/, '')
  if (pathname.startsWith('files/')) {
    return pathname.slice('files/'.length)
  }
  return pathname
}

function mapEncryptionToBitLocker(
  status: WindowsEncryptionStatus | undefined,
  diskEncrypted?: boolean,
): BitLockerStatus {
  if (status === 'all') {
    return 'on'
  }
  if (status === 'partial') {
    return 'partial'
  }
  if (status === 'none') {
    return 'off'
  }
  if (diskEncrypted === true) {
    return 'on'
  }
  if (diskEncrypted === false) {
    return 'off'
  }
  return 'unknown'
}
