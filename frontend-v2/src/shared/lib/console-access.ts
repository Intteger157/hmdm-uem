import {
  DEFAULT_ACCESS_LEVEL,
  isAccessLevel,
  type AccessLevel,
} from '@/shared/lib/access-level'
import {
  DEFAULT_PLATFORM_SCOPE,
  isPlatformScope,
  type PlatformScope,
} from '@/shared/lib/platform-scope'

/**
 * The two RBAC dimensions of the signed-in operator's role, plus the super-admin
 * flag that overrides both.
 *
 * Kept as one object because the three values arrive together from a single
 * request and are always set or cleared together — that also makes "not resolved
 * yet" a single null instead of three separate unknowns.
 */
export interface ConsoleAccess {
  platformScope: PlatformScope
  accessLevel: AccessLevel
  superAdmin: boolean
}

/**
 * Applied while the operator's own role is unknown. See DEFAULT_ACCESS_LEVEL for
 * why this errs towards showing too much rather than too little.
 */
export const UNRESTRICTED_ACCESS: ConsoleAccess = {
  platformScope: DEFAULT_PLATFORM_SCOPE,
  accessLevel: DEFAULT_ACCESS_LEVEL,
  superAdmin: false,
}

/** Narrows a persisted or fetched value that TypeScript cannot vouch for. */
export function isConsoleAccess(value: unknown): value is ConsoleAccess {
  if (value == null || typeof value !== 'object') {
    return false
  }
  const candidate = value as Partial<ConsoleAccess>
  return (
    isPlatformScope(candidate.platformScope) &&
    isAccessLevel(candidate.accessLevel) &&
    typeof candidate.superAdmin === 'boolean'
  )
}

/**
 * Reads the RBAC dimensions out of a /me payload, falling back to the
 * unrestricted defaults for values the server did not send or that this build
 * does not recognise.
 */
export function toConsoleAccess(profile: {
  platformScope?: unknown
  accessLevel?: unknown
  superAdmin?: unknown
}): ConsoleAccess {
  return {
    platformScope: isPlatformScope(profile.platformScope)
      ? profile.platformScope
      : UNRESTRICTED_ACCESS.platformScope,
    accessLevel: isAccessLevel(profile.accessLevel)
      ? profile.accessLevel
      : UNRESTRICTED_ACCESS.accessLevel,
    superAdmin: profile.superAdmin === true,
  }
}

/**
 * Mirrors UserRole.IsConsoleAdministrator in the Go service: whether the role may
 * administer the console itself — users, roles, settings — rather than the
 * devices of one ecosystem.
 *
 * A Windows Engineer is unrestricted inside its own ecosystem yet must not edit
 * roles, because that would let it grant itself the other one.
 */
export function isConsoleAdministrator(access: ConsoleAccess): boolean {
  return access.superAdmin || (access.platformScope === 'global' && access.accessLevel === 'high')
}
