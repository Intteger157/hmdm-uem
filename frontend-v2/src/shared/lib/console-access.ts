import {
  LEAST_ACCESS_LEVEL,
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
 * Applied while the operator's own role is unknown, which the two dimensions have
 * to treat differently.
 *
 * The scope decides which ecosystem's navigation renders. It is a filter rather
 * than a privilege, and assuming neither ecosystem would leave an empty console,
 * so it opens to "global" and lets the servers refuse the actual calls.
 *
 * The level decides what may be done, so it closes to the weakest. Assuming
 * "high" alongside a "global" scope also satisfies isConsoleAdministrator, which
 * would silently promote an operator whose /me lookup merely failed — the console
 * would offer the user, role and settings screens to anyone it could not identify.
 */
export const UNRESOLVED_ACCESS: ConsoleAccess = {
  platformScope: DEFAULT_PLATFORM_SCOPE,
  accessLevel: LEAST_ACCESS_LEVEL,
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
 * Reads the RBAC dimensions out of a /me payload.
 *
 * A value the server did not send, or that this build does not recognise, falls
 * back to UNRESOLVED_ACCESS rather than to whatever the rest of the payload
 * implies, so a field the console cannot interpret never widens what it offers.
 */
export function toConsoleAccess(profile: {
  platformScope?: unknown
  accessLevel?: unknown
  superAdmin?: unknown
}): ConsoleAccess {
  if (!isAccessLevel(profile.accessLevel)) {
    console.warn(
      '[rbac] /me did not report a usable accessLevel; restricting the console to read-only',
      { accessLevel: profile.accessLevel },
    )
  }

  return {
    platformScope: isPlatformScope(profile.platformScope)
      ? profile.platformScope
      : UNRESOLVED_ACCESS.platformScope,
    accessLevel: isAccessLevel(profile.accessLevel)
      ? profile.accessLevel
      : UNRESOLVED_ACCESS.accessLevel,
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
