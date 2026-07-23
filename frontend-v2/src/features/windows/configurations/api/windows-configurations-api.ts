import axios from 'axios'
import { API_BASE } from '@/shared/api/config'
import type {
  UpsertWindowsConfigProfilePayload,
  WindowsConfigProfile,
  WindowsConfigProfileListResponse,
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
