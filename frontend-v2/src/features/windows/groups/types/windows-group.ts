export interface WindowsGroup {
  id: number
  name: string
  description?: string
  deviceCount: number
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
}
