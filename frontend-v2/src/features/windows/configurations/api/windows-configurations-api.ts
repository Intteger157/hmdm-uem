import axios from 'axios'
import { API_BASE } from '@/shared/api/config'
import type {
  UpsertWindowsConfigProfilePayload,
  WindowsConfigProfile,
  WindowsConfigProfileListResponse,
  WindowsConfigProfileAssignments,
  WindowsDeviceGroup,
  WindowsDeviceGroupListResponse,
  WindowsEffectiveConfig,
  WindowsDeviceOption,
} from '@/features/windows/configurations/types/config-profile'

const windowsApi = axios.create({
  baseURL: `${API_BASE}/windows`,
  headers: {
    'Content-Type': 'application/json',
  },
})

export async function fetchWindowsConfigProfiles(): Promise<WindowsConfigProfileListResponse> {
  const response = await windowsApi.get<WindowsConfigProfileListResponse>('/configurations')
  return response.data
}

export async function fetchWindowsConfigProfileById(id: number): Promise<WindowsConfigProfile> {
  const response = await windowsApi.get<WindowsConfigProfile>(`/configurations/${id}`)
  return response.data
}

export async function createWindowsConfigProfile(
  payload: UpsertWindowsConfigProfilePayload,
): Promise<WindowsConfigProfile> {
  const response = await windowsApi.post<WindowsConfigProfile>('/configurations', payload)
  return response.data
}

export async function updateWindowsConfigProfile(
  id: number,
  payload: UpsertWindowsConfigProfilePayload,
): Promise<WindowsConfigProfile> {
  const response = await windowsApi.put<WindowsConfigProfile>(`/configurations/${id}`, payload)
  return response.data
}

export async function deleteWindowsConfigProfile(id: number): Promise<void> {
  await windowsApi.delete(`/configurations/${id}`)
}

export async function fetchWindowsConfigProfileAssignments(
  profileId: number,
): Promise<WindowsConfigProfileAssignments> {
  const response = await windowsApi.get<WindowsConfigProfileAssignments>(
    `/configurations/${profileId}/assignments`,
  )
  return response.data
}

export async function assignWindowsConfigProfile(
  profileId: number,
  assignments: WindowsConfigProfileAssignments,
): Promise<WindowsConfigProfileAssignments> {
  const response = await windowsApi.post<WindowsConfigProfileAssignments>(
    `/configurations/${profileId}/assign`,
    assignments,
  )
  return response.data
}

export async function fetchWindowsDeviceGroups(): Promise<WindowsDeviceGroupListResponse> {
  const response = await windowsApi.get<WindowsDeviceGroupListResponse>('/groups')
  return response.data
}

export async function createWindowsDeviceGroup(name: string): Promise<WindowsDeviceGroup> {
  const response = await windowsApi.post<WindowsDeviceGroup>('/groups', { name })
  return response.data
}

export async function fetchWindowsDeviceOptions(): Promise<WindowsDeviceOption[]> {
  const response = await windowsApi.get<{ items: Array<{ id: number; hardwareId: string; hostname: string }> }>(
    '/devices',
    { params: { pageNum: 1, pageSize: 200 } },
  )
  return response.data.items.map((device) => ({
    id: device.id,
    hardwareId: device.hardwareId,
    label: device.hostname?.trim() ? `${device.hostname} (${device.hardwareId})` : device.hardwareId,
  }))
}

export async function fetchWindowsDeviceEffectiveConfig(
  hardwareId: string,
): Promise<WindowsEffectiveConfig> {
  const encoded = encodeURIComponent(hardwareId)
  const response = await windowsApi.get<WindowsEffectiveConfig>(`/devices/${encoded}/effective-config`)
  return response.data
}
