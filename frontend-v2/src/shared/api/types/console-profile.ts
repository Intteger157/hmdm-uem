import type { PlatformScope } from '@/shared/lib/platform-scope'

/** Payload of GET /rest/windows/me on the Go server. */
export interface ConsoleProfile {
  userId: number
  login: string
  roleId: number
  roleName: string
  superAdmin: boolean
  platformScope: PlatformScope
  accessLevel: string
}
