import { api } from '@/shared/api/client'
import { consoleAdminApi, shouldFallbackFromGo } from '@/features/auth/api/console-admin-api'
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

async function fetchRolesFromGo(): Promise<UserRole[]> {
  const response = await consoleAdminApi.get<{ items: UserRole[] }>('/console/roles')
  return response.data.items ?? []
}

async function fetchRolePermissionsFromGo(): Promise<RolePermission[]> {
  const response = await consoleAdminApi.get<{ items: RolePermission[] }>('/console/role-permissions')
  return response.data.items ?? []
}

export async function fetchRolePermissions(): Promise<RolePermission[]> {
  try {
    return await fetchRolePermissionsFromGo()
  } catch (error) {
    if (!shouldFallbackFromGo(error)) {
      throw error
    }
    const response = await api.get<ApiResponse<RolePermission[]>>('/private/roles/permissions')
    return unwrapApiResponse(response.data)
  }
}

export async function fetchRoles(): Promise<UserRole[]> {
  try {
    return await fetchRolesFromGo()
  } catch (error) {
    if (!shouldFallbackFromGo(error)) {
      throw error
    }
    const response = await api.get<ApiResponse<UserRole[]>>('/private/roles/all')
    return unwrapApiResponse(response.data)
  }
}

export async function upsertRole(role: UserRole): Promise<void> {
  const response = await api.put<ApiResponse<unknown>>('/private/roles', role)
  unwrapApiResponse(response.data)
}

export async function deleteRole(id: number): Promise<void> {
  const response = await api.delete<ApiResponse<unknown>>(`/private/roles/${id}`)
  unwrapApiResponse(response.data)
}
