export interface WindowsGroup {
  id: number
  name: string
  description?: string
  isDefault?: boolean
  deviceCount: number
  deviceIds?: number[]
  configurationId?: number
  configurationName?: string
}

export interface WindowsGroupListResponse {
  items: WindowsGroup[]
  totalItemsCount: number
}

export interface UpsertWindowsGroupPayload {
  name: string
  description?: string
  isDefault?: boolean
  configurationId?: number | null
  deviceIds?: number[]
}
