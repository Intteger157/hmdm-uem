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
  split?: boolean
  arch?: string
  filePath?: string
  deletionProhibited?: boolean
  system?: boolean
  type?: string
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

export interface ApplicationConfigurationLink {
  id?: number
  customerId?: number
  configurationId?: number
  configurationName?: string
  applicationId?: number
  applicationName?: string
  action?: number
  showIcon?: boolean
  screenOrder?: number
  keyCode?: number
  bottom?: boolean
  longTap?: boolean
  remove?: boolean
  outdated?: boolean
  latestVersionText?: string
  currentVersionText?: string
  notify?: boolean
}

export async function fetchApplications(): Promise<Application[]> {
  const response = await api.get<ApiResponse<Application[]>>('/private/applications/search')
  return unwrapApiResponse(response.data)
}

export async function fetchApplicationById(id: number): Promise<Application> {
  const response = await api.get<ApiResponse<Application>>(`/private/applications/${id}`)
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

export async function deleteApplicationVersion(versionId: number): Promise<void> {
  const response = await api.delete<ApiResponse<unknown>>(
    `/private/applications/versions/${versionId}`
  )
  unwrapApiResponse(response.data)
}

export async function fetchApplicationConfigurations(
  applicationId: number
): Promise<ApplicationConfigurationLink[]> {
  const response = await api.get<ApiResponse<ApplicationConfigurationLink[]>>(
    `/private/applications/configurations/${applicationId}`
  )
  return unwrapApiResponse(response.data)
}

export async function updateApplicationConfigurations(request: {
  applicationId: number
  configurations: ApplicationConfigurationLink[]
}): Promise<void> {
  const response = await api.post<ApiResponse<unknown>>(
    '/private/applications/configurations',
    request
  )
  unwrapApiResponse(response.data)
}

export function isInstallOptionAvailable(application: Application): boolean {
  return (
    !application.system &&
    application.type === 'app' &&
    Boolean(application.url || application.urlArm64 || application.urlArmeabi)
  )
}

export function isRemoveOptionAvailable(application: Application): boolean {
  return !application.system && application.type === 'app'
}

export class SaveAndroidApplicationError extends Error {
  readonly code: 'VERSION_TOO_OLD' | 'VERSION_EXISTS' | 'VALIDATION'

  constructor(code: 'VERSION_TOO_OLD' | 'VERSION_EXISTS' | 'VALIDATION') {
    super(code)
    this.code = code
  }
}

export interface SaveAndroidApplicationResult {
  application: Application
  versionId?: number
  createdNewVersion: boolean
}

/** Create a new app or add a new version when package already exists (legacy behavior). */
export async function saveAndroidApplicationRequest(
  request: Application,
  options: { uploadComplete?: boolean; fileSelected?: boolean } = {}
): Promise<SaveAndroidApplicationResult> {
  if (request.id) {
    const saved = await upsertAndroidApplication(request)
    return { application: saved ?? request, createdNewVersion: false }
  }

  const existingApps = await validateApplicationPackage(request)

  if (existingApps.length === 0) {
    const saved = await upsertAndroidApplication(request)
    return { application: saved, createdNewVersion: false }
  }

  const existing =
    existingApps.find(
      (app) => app.pkg?.toLowerCase() === request.pkg?.trim().toLowerCase()
    ) ?? existingApps[0]

  const reqCode = request.versionCode ?? 0
  const existCode = existing.versionCode ?? 0

  if (reqCode > 0 && existCode > 0 && reqCode < existCode) {
    throw new SaveAndroidApplicationError('VERSION_TOO_OLD')
  }

  if (
    reqCode > 0 &&
    existCode > 0 &&
    reqCode === existCode &&
    options.uploadComplete &&
    options.fileSelected
  ) {
    throw new SaveAndroidApplicationError('VERSION_EXISTS')
  }

  const version = await upsertApplicationVersion({
    applicationId: existing.id,
    version: request.version,
    versionCode: request.versionCode,
    arch: request.arch || undefined,
    filePath: request.filePath,
  })

  return {
    application: {
      ...existing,
      name: request.name.trim() || existing.name,
      version: version.version ?? request.version,
      latestVersion: version.id,
      usedVersionId: version.id,
    },
    versionId: version.id,
    createdNewVersion: true,
  }
}
