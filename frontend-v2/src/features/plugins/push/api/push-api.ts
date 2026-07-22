import { api } from '@/shared/api/client'
import type { ApiResponse } from '@/shared/api/types/api-response'
import { unwrapApiResponse } from '@/shared/api/types/api-response'
import type { PaginatedData } from '@/shared/api/types/device'

export interface PushMessage {
  id?: number
  deviceNumber?: string
  messageType?: string
  payload?: string
  createTime?: number
  status?: string | number
}

export interface PushSearchRequest {
  pageNum?: number
  pageSize?: number
  deviceFilter?: string
  messageFilter?: string
  dateFrom?: number | null
  dateTo?: number | null
  sortValue?: string
}

export interface PushSendRequest {
  scope: 'device' | 'group' | 'configuration'
  deviceNumber?: string
  groupId?: number
  configurationId?: number
  messageType: string
  payload?: string
}

export async function searchPushMessages(
  request: PushSearchRequest = {}
): Promise<PaginatedData<PushMessage>> {
  const response = await api.post<ApiResponse<PaginatedData<PushMessage>>>(
    '/plugins/push/private/search',
    {
      pageNum: 1,
      pageSize: 50,
      sortValue: 'createTime',
      ...request,
    }
  )
  return unwrapApiResponse(response.data)
}

export async function sendPushMessage(request: PushSendRequest): Promise<void> {
  const response = await api.post<ApiResponse<unknown>>('/plugins/push/private/send', request)
  unwrapApiResponse(response.data)
}

export async function deletePushMessage(id: number): Promise<void> {
  const response = await api.delete<ApiResponse<unknown>>(`/plugins/push/private/${id}`)
  unwrapApiResponse(response.data)
}
