import { api } from '@/shared/api/client'
import type { ApiResponse } from '@/shared/api/types/api-response'
import { unwrapApiResponse } from '@/shared/api/types/api-response'

export interface DeviceGroup {
  id?: number
  name: string
  customerId?: number
  common?: boolean
  [key: string]: unknown
}

export async function fetchGroups(): Promise<DeviceGroup[]> {
  const response = await api.get<ApiResponse<DeviceGroup[]>>('/private/groups/search')
  return unwrapApiResponse(response.data)
}

export async function upsertGroup(group: DeviceGroup): Promise<void> {
  const response = await api.put<ApiResponse<unknown>>('/private/groups', group)
  unwrapApiResponse(response.data)
}

export async function deleteGroup(id: number): Promise<void> {
  const response = await api.delete<ApiResponse<unknown>>(`/private/groups/${id}`)
  unwrapApiResponse(response.data)
}
