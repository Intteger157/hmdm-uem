import { useMemo } from 'react'
import { useAuthStore } from '@/features/auth/store/auth-store'
import type { Platform } from '@/shared/api/types/platform'
import { accessLevelAtLeast, type AccessLevel } from '@/shared/lib/access-level'
import {
  isConsoleAdministrator,
  UNRESTRICTED_ACCESS,
  type ConsoleAccess,
} from '@/shared/lib/console-access'
import { scopeAllowsPlatform, scopedPlatform } from '@/shared/lib/platform-scope'
import type { PlatformScope } from '@/shared/lib/platform-scope'

/**
 * What the signed-in operator's role permits, resolved once so components do not
 * each re-derive the matrix.
 *
 * Hiding a control is a courtesy, not the enforcement: the Go service applies the
 * same matrix to every route it serves. The Java-served Android routes do not
 * check either dimension yet, so there this is the only thing in the way.
 */
export interface Permissions {
  platformScope: PlatformScope
  accessLevel: AccessLevel
  superAdmin: boolean

  /** Mirrors UserRole.AllowsAccessLevel: does the role meet this minimum? */
  atLeast: (required: AccessLevel) => boolean

  /** Observer: every write is refused, so action columns have nothing to show. */
  readOnly: boolean

  /**
   * Operator and up. Covers the routine maintenance writes — upload, create,
   * save, assign, and the everyday device commands like sync and lock.
   */
  canMutate: boolean

  /**
   * Engineer only. Deleting a configuration, an app or version, a script or a
   * device record discards data that other records point at, and no opposite
   * call brings it back.
   */
  canDeleteCritical: boolean

  /**
   * Engineer only. Wipe, the live terminal, the remote task manager and the
   * remote file explorer each hand over the device itself rather than edit a
   * record about it.
   */
  canUsePrivilegedTools: boolean

  /** Whether the console's administration area is available to this role. */
  isAdministrator: boolean

  /** Whether the role may manage the given device ecosystem. */
  allowsPlatform: (platform: Platform) => boolean

  /** The one ecosystem the role is pinned to, or null when it manages both. */
  lockedPlatform: Platform | null
}

/**
 * Resolves permissions from a stored access object, treating an unresolved role
 * as unrestricted. Exported for the router guards, which run outside React.
 */
export function resolvePermissions(access: ConsoleAccess | null): Permissions {
  const effective = access ?? UNRESTRICTED_ACCESS
  const atLeast = (required: AccessLevel) => {
    // Super admins pass every level check server-side, so the console must not
    // hide actions from them on the strength of a stored level.
    return effective.superAdmin || accessLevelAtLeast(effective.accessLevel, required)
  }
  const engineer = atLeast('high')

  return {
    platformScope: effective.platformScope,
    accessLevel: effective.accessLevel,
    superAdmin: effective.superAdmin,
    atLeast,
    readOnly: !atLeast('mid'),
    canMutate: atLeast('mid'),
    canDeleteCritical: engineer,
    canUsePrivilegedTools: engineer,
    isAdministrator: isConsoleAdministrator(effective),
    allowsPlatform: (platform) => scopeAllowsPlatform(effective.platformScope, platform),
    lockedPlatform: scopedPlatform(effective.platformScope),
  }
}

/** Reads the current operator's permissions. */
export function usePermissions(): Permissions {
  const access = useAuthStore((s) => s.access)
  return useMemo(() => resolvePermissions(access), [access])
}
