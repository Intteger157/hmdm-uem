import axios from 'axios'
import { API_BASE } from '@/shared/api/config'
import { useAuthStore } from '@/features/auth/store/auth-store'
import type {
  AssignDeviceAppPayload,
  CreateApplicationPayload,
  CreateApplicationVersionPayload,
  DeviceAppStatusListResponse,
  ProfileAppsPayload,
  ProfileAppsResponse,
  SoftwareApp,
  SoftwareAppListResponse,
  UpdateApplicationPayload,
  UploadApplicationResponse,
} from '@/features/windows/applications/types/software-app'

const windowsApi = axios.create({
  baseURL: `${API_BASE}/windows`,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Windows App Catalog uses server-windows (Go) only. Do not call Java /private/applications APIs here.

export async function fetchSoftwareApps(): Promise<SoftwareApp[]> {
  const response = await windowsApi.get<SoftwareAppListResponse>('/apps')
  return response.data.items
}

export async function fetchSoftwareApp(id: number): Promise<SoftwareApp> {
  const response = await windowsApi.get<SoftwareApp>(`/apps/${id}`)
  return response.data
}

export async function createSoftwareApp(payload: CreateApplicationPayload): Promise<SoftwareApp> {
  const response = await windowsApi.post<SoftwareApp>('/apps', payload)
  return response.data
}

export async function updateSoftwareApp(id: number, payload: UpdateApplicationPayload): Promise<SoftwareApp> {
  const response = await windowsApi.put<SoftwareApp>(`/apps/${id}`, payload)
  return response.data
}

export async function createApplicationVersion(
  appId: number,
  payload: CreateApplicationVersionPayload,
): Promise<SoftwareApp> {
  await windowsApi.post(`/apps/${appId}/versions`, payload)
  return fetchSoftwareApp(appId)
}

export async function deleteSoftwareApp(id: number): Promise<void> {
  await windowsApi.delete(`/apps/${id}`)
}

export interface UploadSoftwareAppOptions {
  appId?: number
  version?: string
  installArgs?: string
}

export async function uploadSoftwareApp(
  file: File,
  options?: UploadSoftwareAppOptions,
): Promise<UploadApplicationResponse> {
  const formData = new FormData()
  formData.append('file', file)
  if (options?.appId != null) {
    formData.append('appId', String(options.appId))
  }
  if (options?.version?.trim()) {
    formData.append('version', options.version.trim())
  }
  if (options?.installArgs?.trim()) {
    formData.append('installArgs', options.installArgs.trim())
  }

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
  payload: ProfileAppsPayload,
): Promise<ProfileAppsResponse> {
  const response = await windowsApi.post<ProfileAppsResponse>(`/configurations/${profileId}/apps`, payload)
  return response.data
}

export async function fetchDeviceAppStatuses(hardwareId: string): Promise<DeviceAppStatusListResponse> {
  const encoded = encodeURIComponent(hardwareId)
  const response = await windowsApi.get<DeviceAppStatusListResponse>(`/devices/${encoded}/apps/status`)
  return response.data
}

export async function assignDeviceApp(
  hardwareId: string,
  appId: number,
  payload?: AssignDeviceAppPayload,
): Promise<void> {
  const encodedDevice = encodeURIComponent(hardwareId)
  await windowsApi.post(`/devices/${encodedDevice}/apps/${appId}/assign`, payload ?? {})
}

export async function unassignDeviceApp(hardwareId: string, appId: number): Promise<void> {
  const encodedDevice = encodeURIComponent(hardwareId)
  await windowsApi.delete(`/devices/${encodedDevice}/apps/${appId}/assign`)
}

export async function retryDeviceApp(hardwareId: string, appId: number): Promise<void> {
  const encodedDevice = encodeURIComponent(hardwareId)
  await windowsApi.post(`/devices/${encodedDevice}/apps/${appId}/retry`)
}
