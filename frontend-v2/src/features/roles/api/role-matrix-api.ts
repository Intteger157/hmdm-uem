import axios from 'axios'
import { WINDOWS_API_BASE } from '@/shared/api/config'
import { useAuthStore } from '@/features/auth/store/auth-store'

export const PLATFORM_SCOPES = ['global', 'windows', 'android'] as const
export type PlatformScope = (typeof PLATFORM_SCOPES)[number]

export const ACCESS_LEVELS = ['high', 'mid', 'low'] as const
export type AccessLevel = (typeof ACCESS_LEVELS)[number]

export const DEFAULT_PLATFORM_SCOPE: PlatformScope = 'global'
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

matrixApi.interceptors.request.use((config) => {
  const jwt = useAuthStore.getState().jwt
  if (jwt) {
    config.headers.Authorization = `Bearer ${jwt}`
  }
  return config
})

export function isPlatformScope(value: unknown): value is PlatformScope {
  return PLATFORM_SCOPES.includes(value as PlatformScope)
}

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
