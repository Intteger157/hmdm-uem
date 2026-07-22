import { api } from '@/shared/api/client'
import { hashPassword } from '@/shared/lib/password'
import type { ApiResponse } from '@/shared/api/types/api-response'
import { unwrapApiResponse } from '@/shared/api/types/api-response'

export interface UserRole {
  id: number
  name: string
  superAdmin?: boolean
}

export interface UserAccount {
  id?: number
  login: string
  name?: string
  email?: string
  userRole?: UserRole
  allDevicesAvailable?: boolean
  allConfigAvailable?: boolean
  passwordReset?: boolean
  [key: string]: unknown
}

export interface UserUpsertInput {
  user: UserAccount
  /** Plain-text password; hashed with MD5 before sending (legacy protocol). */
  newPassword?: string
}

export async function fetchUsers(): Promise<UserAccount[]> {
  const response = await api.get<ApiResponse<UserAccount[]>>('/private/users/all')
  return unwrapApiResponse(response.data)
}

export async function fetchUserRoles(): Promise<UserRole[]> {
  const response = await api.get<ApiResponse<UserRole[]>>('/private/users/roles')
  return unwrapApiResponse(response.data)
}

export async function upsertUser({ user, newPassword }: UserUpsertInput): Promise<void> {
  const body: Record<string, unknown> = { ...user }

  if (newPassword) {
    const hashed = hashPassword(newPassword)
    body.newPassword = hashed
    body.confirmModal = hashed
  }

  const response = await api.put<ApiResponse<unknown>>('/private/users', body)
  unwrapApiResponse(response.data)
}

export async function deleteUser(id: number): Promise<void> {
  const response = await api.delete<ApiResponse<unknown>>(`/private/users/other/${id}`)
  unwrapApiResponse(response.data)
}
