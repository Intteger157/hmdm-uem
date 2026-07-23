export interface SoftwareApp {
  id: number
  name: string
  version: string
  downloadUrl: string
  installArgs: string
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
  downloadUrl: string
  installArgs?: string
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
