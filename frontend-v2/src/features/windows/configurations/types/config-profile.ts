export interface WindowsConfigProfilePayload {
  defenderEnabled: boolean
  blockUsbStorage: boolean
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

export const DEFAULT_WINDOWS_CONFIG_PROFILE_PAYLOAD: WindowsConfigProfilePayload = {
  defenderEnabled: false,
  blockUsbStorage: false,
  screenLockTimeout: 0,
}
