import type { Platform } from '@/shared/api/types/platform'

export const PLATFORM_SCOPES = ['global', 'windows', 'android'] as const
export type PlatformScope = (typeof PLATFORM_SCOPES)[number]

/**
 * Scope assumed when the console cannot resolve its own role.
 *
 * Hiding navigation is a convenience — both servers reject out-of-scope calls on
 * their own. Falling back to "global" therefore degrades to the pre-RBAC console
 * when the Go service is unreachable, instead of locking an operator out of a UI
 * they are allowed to use.
 */
export const DEFAULT_PLATFORM_SCOPE: PlatformScope = 'global'

export function isPlatformScope(value: unknown): value is PlatformScope {
  return PLATFORM_SCOPES.includes(value as PlatformScope)
}

/** Mirrors UserRole.AllowsPlatform in the Go service. */
export function scopeAllowsPlatform(
  scope: PlatformScope | null | undefined,
  platform: Platform,
): boolean {
  const effective = scope ?? DEFAULT_PLATFORM_SCOPE
  return effective === 'global' || effective === platform
}

/**
 * The one platform a scope pins the console to, or null when the operator
 * manages both and the platform stays their choice.
 */
export function scopedPlatform(scope: PlatformScope | null | undefined): Platform | null {
  const effective = scope ?? DEFAULT_PLATFORM_SCOPE
  return effective === 'global' ? null : effective
}
