import axios from 'axios'
import { api } from '@/shared/api/client'
import { API_BASE } from '@/shared/api/config'
import type { ApiResponse } from '@/shared/api/types/api-response'
import { unwrapApiResponse } from '@/shared/api/types/api-response'
import { useAuthStore } from '@/features/auth/store/auth-store'

export interface Application {
  id?: number
  name: string
  pkg?: string
  version?: string
  versionCode?: number
  url?: string
  urlArm64?: string
  urlArmeabi?: string
  split?: boolean
  showIcon?: boolean
  useKiosk?: boolean
  system?: boolean
  runAfterInstall?: boolean
  runAtBoot?: boolean
  type?: string
  iconText?: string
  customerId?: number
  commonApplication?: boolean
  deletionProhibited?: boolean
  arch?: string
  filePath?: string
  latestVersion?: number
  usedVersionId?: number
  action?: number
  screenOrder?: number
  keyCode?: number
  bottom?: boolean
  longTap?: boolean
  outdated?: boolean
  remove?: boolean
  intent?: string
  [key: string]: unknown
}

export interface ApplicationVersion {
  id?: number
  applicationId?: number
  version?: string
  versionCode?: number
  url?: string
  urlArm64?: string
  urlArmeabi?: string
  arch?: string
  filePath?: string
}

export interface ApkFileDetails {
  pkg?: string
  version?: string
  versionCode?: number
  arch?: string | null
  name?: string
}

export interface FileUploadResult {
  serverPath?: string
  name?: string
  fileDetails?: ApkFileDetails
  application?: Application
  exists?: boolean
  complete?: boolean
}

export async function fetchApplications(): Promise<Application[]> {
  const response = await api.get<ApiResponse<Application[]>>('/private/applications/search')
  return unwrapApiResponse(response.data)
}

export async function fetchApplicationVersions(applicationId: number): Promise<ApplicationVersion[]> {
  const response = await api.get<ApiResponse<ApplicationVersion[]>>(
    `/private/applications/${applicationId}/versions`
  )
  return unwrapApiResponse(response.data)
}

export async function uploadApkFile(
  file: File,
  onProgress?: (loaded: number, total: number) => void
): Promise<FileUploadResult> {
  const formData = new FormData()
  formData.append('file', file)

  const jwt = useAuthStore.getState().jwt
  const response = await axios.post<ApiResponse<FileUploadResult>>(
    `${API_BASE}/private/web-ui-files`,
    formData,
    {
      headers: {
        ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
      },
      onUploadProgress: (event) => {
        if (event.total && onProgress) {
          onProgress(event.loaded, event.total)
        }
      },
    }
  )

  return unwrapApiResponse(response.data)
}

export async function validateApplicationPackage(
  application: Application
): Promise<Application[]> {
  const response = await api.put<ApiResponse<Application[]>>(
    '/private/applications/validatePkg',
    application
  )
  return unwrapApiResponse(response.data)
}

/** Create or update an Android application entry. */
export async function upsertAndroidApplication(application: Application): Promise<Application> {
  const response = await api.put<ApiResponse<Application>>('/private/applications/android', application)
  return unwrapApiResponse(response.data)
}

export async function upsertApplicationVersion(
  version: ApplicationVersion
): Promise<ApplicationVersion> {
  const response = await api.put<ApiResponse<ApplicationVersion>>(
    '/private/applications/versions',
    version
  )
  return unwrapApiResponse(response.data)
}

export async function deleteApplication(id: number): Promise<void> {
  const response = await api.delete<ApiResponse<unknown>>(`/private/applications/${id}`)
  unwrapApiResponse(response.data)
}
