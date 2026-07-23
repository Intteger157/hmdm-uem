export interface WindowsConfigProfilePayload {
  defenderEnabled: boolean
  blockUsbStorage: boolean
  usbReadOnly: boolean
  screenLockTimeout: number
}

export interface WindowsConfigProfile {
  id: number
  name: string
  description: string
  payload: WindowsConfigProfilePayload
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface WindowsConfigProfileListResponse {
  items: WindowsConfigProfile[]
  totalItemsCount: number
}

export interface UpsertWindowsConfigProfilePayload {
  name: string
  description?: string
  payload: WindowsConfigProfilePayload
  isActive: boolean
}

export interface WindowsDeviceGroup {
  id: number
  name: string
}

export interface WindowsDeviceGroupListResponse {
  items: WindowsDeviceGroup[]
  totalItemsCount: number
}

export interface WindowsConfigProfileAssignments {
  groupIds: number[]
  deviceIds: number[]
}

export interface WindowsEffectiveConfig {
  payload: WindowsConfigProfilePayload
  requiredApps?: Array<{
    id: number
    name: string
    version: string
    downloadUrl: string
    installArgs: string
  }>
  profileId?: number
  profileName?: string
  source?: 'direct' | 'group' | ''
  appliedProfiles: Array<{
    profileId: number
    profileName: string
    source: 'direct' | 'group'
  }>
}

export interface WindowsDeviceOption {
  id: number
  hardwareId: string
  label: string
}

export const DEFAULT_WINDOWS_CONFIG_PROFILE_PAYLOAD: WindowsConfigProfilePayload = {
  defenderEnabled: false,
  blockUsbStorage: false,
  usbReadOnly: false,
  screenLockTimeout: 0,
}
