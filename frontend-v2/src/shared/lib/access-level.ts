/**
 * Ordered weakest to strongest — accessLevelRank reads the rank off this order,
 * so it must stay ascending.
 */
export const ACCESS_LEVELS = ['low', 'mid', 'high'] as const
export type AccessLevel = (typeof ACCESS_LEVELS)[number]

/**
 * Level assumed when the console cannot resolve its own role.
 *
 * Mirrors DEFAULT_PLATFORM_SCOPE, and for the same reason: a role predating the
 * matrix columns was unrestricted, so degrading to the pre-RBAC console beats
 * greying out every button because the Go service was briefly unreachable. The
 * server is what actually refuses the call.
 */
export const DEFAULT_ACCESS_LEVEL: AccessLevel = 'high'

export function isAccessLevel(value: unknown): value is AccessLevel {
  return ACCESS_LEVELS.includes(value as AccessLevel)
}

/** Mirrors models.AccessLevelRank in the Go service. */
export function accessLevelRank(level: AccessLevel): number {
  return ACCESS_LEVELS.indexOf(level)
}

/** Mirrors UserRole.AllowsAccessLevel in the Go service. */
export function accessLevelAtLeast(level: AccessLevel, required: AccessLevel): boolean {
  return accessLevelRank(level) >= accessLevelRank(required)
}
