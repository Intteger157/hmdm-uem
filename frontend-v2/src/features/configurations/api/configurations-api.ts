import { api } from '@/shared/api/client'
import type { ApiResponse } from '@/shared/api/types/api-response'
import { unwrapApiResponse } from '@/shared/api/types/api-response'
import type { Configuration, ConfigurationCopyRequest } from '@/features/configurations/types/configuration'

export type { Configuration, ConfigurationCopyRequest }

export async function fetchConfigurations(): Promise<Configuration[]> {
  const response = await api.get<ApiResponse<Configuration[]>>('/private/configurations/search')
  return unwrapApiResponse(response.data)
}

export async function fetchConfigurationById(id: number): Promise<Configuration> {
  const response = await api.get<ApiResponse<Configuration>>(`/private/configurations/${id}`)
  return unwrapApiResponse(response.data)
}

export async function upsertConfiguration(configuration: Configuration): Promise<Configuration> {
  const response = await api.put<ApiResponse<Configuration>>('/private/configurations', configuration)
  return unwrapApiResponse(response.data)
}

export async function copyConfiguration(request: ConfigurationCopyRequest): Promise<void> {
  const response = await api.put<ApiResponse<unknown>>('/private/configurations/copy', request)
  unwrapApiResponse(response.data)
}

export async function deleteConfiguration(id: number): Promise<void> {
  const response = await api.delete<ApiResponse<unknown>>(`/private/configurations/${id}`)
  unwrapApiResponse(response.data)
}
