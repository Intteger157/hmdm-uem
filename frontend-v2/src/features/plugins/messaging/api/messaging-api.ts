import { api } from '@/shared/api/client'
import type { ApiResponse } from '@/shared/api/types/api-response'
import { unwrapApiResponse } from '@/shared/api/types/api-response'
import type { PaginatedData } from '@/shared/api/types/device'

export interface MessagingMessage {
  id?: number
  deviceNumber?: string
  message?: string
  createTime?: number
  status?: string | number
}

export interface MessagingSearchRequest {
  pageNum?: number
  pageSize?: number
  deviceFilter?: string
  messageFilter?: string
  dateFrom?: number | null
  dateTo?: number | null
  sortValue?: string
}

export interface MessagingSendRequest {
  scope: 'device' | 'group' | 'configuration'
  deviceNumber?: string
  groupId?: number
  configurationId?: number
  message: string
}

export async function searchMessagingMessages(
  request: MessagingSearchRequest = {}
): Promise<PaginatedData<MessagingMessage>> {
  const response = await api.post<ApiResponse<PaginatedData<MessagingMessage>>>(
    '/plugins/messaging/private/search',
    {
      pageNum: 1,
      pageSize: 50,
      sortValue: 'createTime',
      ...request,
    }
  )
  return unwrapApiResponse(response.data)
}

export async function sendMessagingMessage(request: MessagingSendRequest): Promise<void> {
  const response = await api.post<ApiResponse<unknown>>('/plugins/messaging/private/send', request)
  unwrapApiResponse(response.data)
}

export async function deleteMessagingMessage(id: number): Promise<void> {
  const response = await api.delete<ApiResponse<unknown>>(`/plugins/messaging/${id}`)
  unwrapApiResponse(response.data)
}
