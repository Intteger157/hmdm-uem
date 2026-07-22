import { api } from '@/shared/api/client'
import { isMockApiEnabled } from '@/shared/api/mock-utils'
import { mockFetchDeviceSummary } from '@/shared/api/mocks/summary'
import type { ApiResponse } from '@/shared/api/types/api-response'
import { unwrapApiResponse } from '@/shared/api/types/api-response'
import type { SummaryResponse } from '@/shared/api/types/summary'

export async function fetchDeviceSummary(): Promise<SummaryResponse> {
  if (isMockApiEnabled()) {
    return mockFetchDeviceSummary()
  }

  const response = await api.get<ApiResponse<SummaryResponse>>('/private/summary/devices')
  return unwrapApiResponse(response.data)
}
