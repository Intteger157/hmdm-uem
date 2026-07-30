import type { ConsoleProfile } from '@/shared/api/types/console-profile'
import type { User } from '@/shared/api/types/user'
import { mockNetworkDelay } from '@/shared/api/mock-utils'
import { DEFAULT_PLATFORM_SCOPE, isPlatformScope } from '@/shared/lib/platform-scope'
import { DEFAULT_ACCESS_LEVEL, isAccessLevel } from '@/shared/lib/access-level'

const ALL_PERMISSIONS = [
  'settings',
  'configurations',
  'applications',
  'edit_devices',
  'edit_device_desc',
  'edit_applications',
  'edit_application_versions',
  'add_config',
  'copy_config',
] as const

export const MOCK_AUTH = {
  login: 'admin',
  password: 'admin',
} as const

export const MOCK_JWT = 'mock-jwt-dev-token'

export const MOCK_USER: User = {
  id: 1,
  login: 'admin',
  name: 'Mock Administrator',
  email: 'admin@localhost',
  customerId: 1,
  singleCustomer: true,
  allDevicesAvailable: true,
  allConfigAvailable: true,
  userRole: {
    id: 1,
    name: 'Super Admin',
    superAdmin: true,
    permissions: ALL_PERMISSIONS.map((name, id) => ({ id: id + 1, name })),
  },
}

export async function mockLoginWithJwt(login: string, plainPassword: string): Promise<string> {
  await mockNetworkDelay()

  if (login === MOCK_AUTH.login && plainPassword === MOCK_AUTH.password) {
    return MOCK_JWT
  }

  const error = new Error('Unauthorized') as Error & { status?: number }
  error.status = 401
  throw error
}

export async function mockFetchCurrentUser(): Promise<User> {
  await mockNetworkDelay()
  return MOCK_USER
}

/**
 * Mock console profile.
 *
 * Set VITE_MOCK_PLATFORM_SCOPE to "windows" or "android" and
 * VITE_MOCK_ACCESS_LEVEL to "low" or "mid" to exercise the scoped navigation and
 * the gated actions without running the Go server. VITE_MOCK_SUPER_ADMIN=false
 * is needed alongside them, because a super admin bypasses both dimensions.
 */
export async function mockFetchConsoleProfile(): Promise<ConsoleProfile> {
  await mockNetworkDelay()

  const scope = import.meta.env.VITE_MOCK_PLATFORM_SCOPE
  const level = import.meta.env.VITE_MOCK_ACCESS_LEVEL
  const superAdmin = import.meta.env.VITE_MOCK_SUPER_ADMIN !== 'false'

  return {
    userId: MOCK_USER.id,
    login: MOCK_USER.login,
    roleId: MOCK_USER.userRole.id,
    roleName: MOCK_USER.userRole.name,
    superAdmin: superAdmin && MOCK_USER.userRole.superAdmin,
    platformScope: isPlatformScope(scope) ? scope : DEFAULT_PLATFORM_SCOPE,
    accessLevel: isAccessLevel(level) ? level : DEFAULT_ACCESS_LEVEL,
  }
}
