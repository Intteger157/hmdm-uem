import type { User } from '@/shared/api/types/user'
import { mockNetworkDelay } from '@/shared/api/mock-utils'

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
