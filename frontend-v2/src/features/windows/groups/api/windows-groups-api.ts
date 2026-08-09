import axios from 'axios'
import { WINDOWS_API_BASE } from '@/shared/api/config'
import { setupAuthInterceptors } from '@/shared/api/setup-auth-interceptors'
import type {
  UpsertWindowsGroupPayload,
  WindowsGroup,
  WindowsGroupListResponse,
} from '@/features/windows/groups/types/windows-group'

const windowsApi = axios.create({
  baseURL: WINDOWS_API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
})

setupAuthInterceptors(windowsApi)

export async function fetchWindowsGroups(): Promise<WindowsGroupListResponse> {
  const response = await windowsApi.get<WindowsGroupListResponse>('/groups')
  return response.data
}

export async function createWindowsGroup(payload: UpsertWindowsGroupPayload): Promise<WindowsGroup> {
  const response = await windowsApi.post<WindowsGroup>('/groups', payload)
  return response.data
}

export async function updateWindowsGroup(
  id: number,
  payload: UpsertWindowsGroupPayload,
): Promise<WindowsGroup> {
  const response = await windowsApi.put<WindowsGroup>(`/groups/${id}`, payload)
  return response.data
}

export async function deleteWindowsGroup(id: number): Promise<void> {
  await windowsApi.delete(`/groups/${id}`)
}
