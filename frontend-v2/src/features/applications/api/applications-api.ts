import { api } from '@/shared/api/client'
import type { ApiResponse } from '@/shared/api/types/api-response'
import { unwrapApiResponse } from '@/shared/api/types/api-response'

export interface Application {
  id?: number
  name: string
  pkg?: string
  version?: string
  url?: string
  showIcon?: boolean
  useKiosk?: boolean
  system?: boolean
  runAfterInstall?: boolean
  runAtBoot?: boolean
  type?: string
  iconText?: string
  customerId?: number
  commonApplication?: boolean
  deletionProhibited?: boolean
  [key: string]: unknown
}

export async function fetchApplications(): Promise<Application[]> {
  const response = await api.get<ApiResponse<Application[]>>('/private/applications/search')
  return unwrapApiResponse(response.data)
}

/** Create or update an Android application entry. */
export async function upsertAndroidApplication(application: Application): Promise<void> {
  const response = await api.put<ApiResponse<unknown>>('/private/applications/android', application)
  unwrapApiResponse(response.data)
}

export async function deleteApplication(id: number): Promise<void> {
  const response = await api.delete<ApiResponse<unknown>>(`/private/applications/${id}`)
  unwrapApiResponse(response.data)
}
