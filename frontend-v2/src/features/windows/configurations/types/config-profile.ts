import type { ProfileAppAssignment } from '@/features/windows/applications/types/software-app'

export interface RequiredAppRequest {
  appId: number
  versionPolicy: string
}

export interface WindowsConfigProfilePayload {
  defenderEnabled: boolean
  blockUsbStorage: boolean
  usbReadOnly: boolean
  screenLockTimeout: number
  requireBitLocker: boolean
}

export interface WindowsConfigProfile {
  id: number
  name: string
  description: string
  payload: WindowsConfigProfilePayload
  isActive: boolean
  isDefault: boolean
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
  isDefault: boolean
  requiredApps?: RequiredAppRequest[]
  appIds?: number[]
  assignments?: ProfileAppAssignment[]
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

export interface WindowsConfigurationPolicy {
  id?: number
  policyPath: string
  valueType: string
  value: string
}

export interface WindowsConfigurationPolicyListResponse {
  items: WindowsConfigurationPolicy[]
}

export const DEFAULT_WINDOWS_CONFIG_PROFILE_PAYLOAD: WindowsConfigProfilePayload = {
  defenderEnabled: false,
  blockUsbStorage: false,
  usbReadOnly: false,
  screenLockTimeout: 0,
  requireBitLocker: false,
}
