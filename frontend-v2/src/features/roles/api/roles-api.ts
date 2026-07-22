import { api } from '@/shared/api/client'
import type { ApiResponse } from '@/shared/api/types/api-response'
import { unwrapApiResponse } from '@/shared/api/types/api-response'

export interface RolePermission {
  id: number
  name: string
  description?: string
  superAdmin?: boolean
}

export interface UserRole {
  id?: number
  name: string
  description?: string
  superAdmin?: boolean
  permissions?: RolePermission[]
}

export async function fetchRolePermissions(): Promise<RolePermission[]> {
  const response = await api.get<ApiResponse<RolePermission[]>>('/private/roles/permissions')
  return unwrapApiResponse(response.data)
}

export async function fetchRoles(): Promise<UserRole[]> {
  const response = await api.get<ApiResponse<UserRole[]>>('/private/roles/all')
  return unwrapApiResponse(response.data)
}

export async function upsertRole(role: UserRole): Promise<void> {
  const response = await api.put<ApiResponse<unknown>>('/private/roles', role)
  unwrapApiResponse(response.data)
}

export async function deleteRole(id: number): Promise<void> {
  const response = await api.delete<ApiResponse<unknown>>(`/private/roles/${id}`)
  unwrapApiResponse(response.data)
}
