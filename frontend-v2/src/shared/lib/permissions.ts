import type { User } from '@/shared/api/types/user'

export function hasPermission(user: User | null, permission: string): boolean {
  if (!user?.userRole) {
    return false
  }
  if (user.userRole.superAdmin) {
    return true
  }
  return user.userRole.permissions.some((p) => p.name === permission)
}
