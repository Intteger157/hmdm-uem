export type SoftwareAppType = 'upload' | 'url' | 'winget'
export type UpdateFrequency = 'daily' | 'weekly'

export interface SoftwareApp {
  id: number
  name: string
  version: string
  downloadUrl: string
  installArgs: string
  appType: SoftwareAppType
  wingetId: string
  autoUpdate: boolean
  updateFrequency: UpdateFrequency | ''
  createdAt: string
  updatedAt: string
}

export interface SoftwareAppListResponse {
  items: SoftwareApp[]
  totalItemsCount: number
}

export interface UpsertSoftwareAppPayload {
  name: string
  version?: string
  downloadUrl?: string
  installArgs?: string
  appType: SoftwareAppType
  wingetId?: string
  autoUpdate?: boolean
  updateFrequency?: UpdateFrequency
}

export interface UploadApplicationResponse {
  url: string
  name: string
  version: string
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
}
