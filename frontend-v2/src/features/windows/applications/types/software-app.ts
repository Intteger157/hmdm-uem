export type SoftwareAppType = 'upload' | 'url' | 'winget'
export type UpdateFrequency = 'daily' | 'weekly'

export interface ApplicationVersion {
  id: number
  appId: number
  version: string
  downloadUrl: string
  installArgs: string
  appType: SoftwareAppType
  wingetId: string
  autoUpdate: boolean
  updateFrequency: UpdateFrequency | ''
  isActive: boolean
  uploadedAt: string
  updatedAt: string
}

export interface SoftwareApp {
  id: number
  name: string
  publisher: string
  description: string
  createdAt: string
  latestVersion: string
  latestVersionId: number
  versions: ApplicationVersion[]
}

export interface SoftwareAppListResponse {
  items: SoftwareApp[]
  totalItemsCount: number
}

export interface UpdateApplicationPayload {
  name: string
  publisher?: string
  description?: string
}

export interface CreateApplicationVersionPayload {
  version?: string
  downloadUrl?: string
  installArgs?: string
  appType: SoftwareAppType
  wingetId?: string
  autoUpdate?: boolean
  updateFrequency?: UpdateFrequency
}

export interface CreateApplicationPayload extends UpdateApplicationPayload, CreateApplicationVersionPayload {}

export interface ProfileAppAssignment {
  appId: number
  versionId?: number | null
}

export interface UploadApplicationResponse {
  url: string
  name: string
  version: string
  detectedArgs: string
  appId: number
  versionId: number
  isNewApp: boolean
}

export type AppDeploymentStatus =
  | 'Pending'
  | 'Downloading'
  | 'Installing'
  | 'Success'
  | 'Failed'

export interface DeviceAppStatusItem {
  appId: number
  appName: string
  appVersion: string
  status: AppDeploymentStatus
  errorMessage?: string
  updatedAt?: string
}

export interface DeviceAppStatusListResponse {
  items: DeviceAppStatusItem[]
  requiredTotal: number
}

export interface ProfileAppsResponse {
  appIds: number[]
  assignments: ProfileAppAssignment[]
}

export interface ProfileAppsPayload {
  appIds?: number[]
  assignments?: ProfileAppAssignment[]
}

export interface AssignDeviceAppPayload {
  versionId?: number | null
}

export function formatLatestVersionLabel(app: SoftwareApp): string {
  if (!app.latestVersion) {
    return '—'
  }
  return `Latest: ${app.latestVersion}`
}

export function getLatestVersion(app: SoftwareApp): ApplicationVersion | undefined {
  if (app.latestVersionId) {
    return app.versions.find((version) => version.id === app.latestVersionId)
  }
  return app.versions[0]
}
