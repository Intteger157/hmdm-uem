import axios from 'axios'
import { WINDOWS_API_BASE } from '@/shared/api/config'
import { setupAuthInterceptors } from '@/shared/api/setup-auth-interceptors'
import {
  DEFAULT_PLATFORM_SCOPE,
  PLATFORM_SCOPES,
  isPlatformScope,
  type PlatformScope,
} from '@/shared/lib/platform-scope'

// Scope lives in shared/ because the auth layer needs it to hide navigation and
// must not depend on the roles feature.
export { DEFAULT_PLATFORM_SCOPE, PLATFORM_SCOPES, isPlatformScope }
export type { PlatformScope }

export const ACCESS_LEVELS = ['high', 'mid', 'low'] as const
export type AccessLevel = (typeof ACCESS_LEVELS)[number]

export const DEFAULT_ACCESS_LEVEL: AccessLevel = 'high'

/** Role matrix row as served by the Go server from the shared userroles table. */
export interface RoleMatrixEntry {
  id: number
  name: string
  superAdmin: boolean
  platformScope: PlatformScope
  accessLevel: AccessLevel
}

interface RoleMatrixListResponse {
  items: RoleMatrixEntry[]
}

export interface RoleMatrixPayload {
  platformScope: PlatformScope
  accessLevel: AccessLevel
}

// The matrix columns live on the Go server; name, description and the legacy
// permission checkboxes are still owned by the Java console API.
const matrixApi = axios.create({
  baseURL: WINDOWS_API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
})

setupAuthInterceptors(matrixApi)

export function isAccessLevel(value: unknown): value is AccessLevel {
  return ACCESS_LEVELS.includes(value as AccessLevel)
}

export async function fetchRoleMatrix(): Promise<RoleMatrixEntry[]> {
  const response = await matrixApi.get<RoleMatrixListResponse>('/roles')
  return response.data.items ?? []
}

export async function updateRoleMatrix(
  roleId: number,
  payload: RoleMatrixPayload,
): Promise<RoleMatrixEntry> {
  const response = await matrixApi.put<RoleMatrixEntry>(`/roles/${roleId}`, payload)
  return response.data
}
