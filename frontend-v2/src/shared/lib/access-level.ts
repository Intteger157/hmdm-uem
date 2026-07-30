/**
 * Ordered weakest to strongest — accessLevelRank reads the rank off this order,
 * so it must stay ascending.
 */
export const ACCESS_LEVELS = ['low', 'mid', 'high'] as const
export type AccessLevel = (typeof ACCESS_LEVELS)[number]

/**
 * Level of a stored role row whose access_level column is empty, mirroring
 * EffectiveAccessLevel in the Go service: such a role predates the matrix and was
 * unrestricted, so demoting it would lock out working accounts.
 *
 * This is not the fallback for a role the console could not read — see
 * LEAST_ACCESS_LEVEL. The distinction matters because the server always resolves a
 * concrete level before answering /me, so the console only ever has to guess when
 * the answer never arrived, and guessing "high" there hands out privileges.
 */
export const DEFAULT_ACCESS_LEVEL: AccessLevel = 'high'

/** Level applied when the console cannot establish what its own role may do. */
export const LEAST_ACCESS_LEVEL: AccessLevel = 'low'

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
