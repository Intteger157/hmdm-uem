import axios from 'axios'
import { API_BASE } from '@/shared/api/config'
import { useAuthStore } from '@/features/auth/store/auth-store'
import type {
  DeviceAppStatusListResponse,
  ProfileAppsResponse,
  SoftwareApp,
  SoftwareAppListResponse,
  UploadApplicationResponse,
  UpsertSoftwareAppPayload,
} from '@/features/windows/applications/types/software-app'

const windowsApi = axios.create({
  baseURL: `${API_BASE}/windows`,
  headers: {
    'Content-Type': 'application/json',
  },
})

export async function fetchSoftwareApps(): Promise<SoftwareAppListResponse> {
  const response = await windowsApi.get<SoftwareAppListResponse>('/apps')
  return response.data
}

export async function createSoftwareApp(payload: UpsertSoftwareAppPayload): Promise<SoftwareApp> {
  const response = await windowsApi.post<SoftwareApp>('/apps', payload)
  return response.data
}

export async function updateSoftwareApp(id: number, payload: UpsertSoftwareAppPayload): Promise<SoftwareApp> {
  const response = await windowsApi.put<SoftwareApp>(`/apps/${id}`, payload)
  return response.data
}

export async function deleteSoftwareApp(id: number): Promise<void> {
  await windowsApi.delete(`/apps/${id}`)
}

export async function uploadSoftwareApp(file: File): Promise<UploadApplicationResponse> {
  const formData = new FormData()
  formData.append('file', file)

  const jwt = useAuthStore.getState().jwt
  const response = await axios.post<UploadApplicationResponse>(
    `${API_BASE}/windows/applications/upload`,
    formData,
    {
      headers: {
        ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
      },
    },
  )
  return response.data
}

export async function fetchConfigProfileApps(profileId: number): Promise<ProfileAppsResponse> {
  const response = await windowsApi.get<ProfileAppsResponse>(`/configurations/${profileId}/apps`)
  return response.data
}

export async function assignConfigProfileApps(
  profileId: number,
  appIds: number[],
): Promise<ProfileAppsResponse> {
  const response = await windowsApi.post<ProfileAppsResponse>(`/configurations/${profileId}/apps`, {
    appIds,
  })
  return response.data
}

export async function fetchDeviceAppStatuses(hardwareId: string): Promise<DeviceAppStatusListResponse> {
  const encoded = encodeURIComponent(hardwareId)
  const response = await windowsApi.get<DeviceAppStatusListResponse>(`/devices/${encoded}/apps/status`)
  return response.data
}
