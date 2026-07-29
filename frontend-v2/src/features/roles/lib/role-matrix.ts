import {
  DEFAULT_ACCESS_LEVEL,
  DEFAULT_PLATFORM_SCOPE,
  fetchRoleMatrix,
  updateRoleMatrix,
  type AccessLevel,
  type PlatformScope,
  type RoleMatrixEntry,
} from '@/features/roles/api/role-matrix-api'
import { upsertRole, type UserRole } from '@/features/roles/api/roles-api'

/** A console role with its RBAC matrix resolved from the Go server. */
export interface RoleWithMatrix extends UserRole {
  platformScope: PlatformScope
  accessLevel: AccessLevel
}

export interface SaveRoleInput extends UserRole {
  platformScope: PlatformScope
  accessLevel: AccessLevel
}

/**
 * Raised when the role itself was written to the Java console but its platform
 * scope could not be stored. The two systems are updated by separate calls, so
 * the UI has to tell the operator that only half the save landed.
 */
export class RoleMatrixNotPersistedError extends Error {
  roleName: string

  constructor(roleName: string, options?: ErrorOptions) {
    super(`Role "${roleName}" was saved, but its platform scope was not`, options)
    this.name = 'RoleMatrixNotPersistedError'
    this.roleName = roleName
  }
}

/** Joins the Java role list with the Go matrix rows, matching on id then name. */
export function mergeRoleMatrix(
  roles: UserRole[] | undefined,
  matrix: RoleMatrixEntry[] | undefined,
): RoleWithMatrix[] {
  const byId = new Map<number, RoleMatrixEntry>()
  const byName = new Map<string, RoleMatrixEntry>()

  for (const entry of matrix ?? []) {
    byId.set(entry.id, entry)
    byName.set(entry.name.trim().toLowerCase(), entry)
  }

  return (roles ?? []).map((role) => {
    const entry =
      (role.id != null ? byId.get(role.id) : undefined) ??
      byName.get(role.name.trim().toLowerCase())

    return {
      ...role,
      platformScope: entry?.platformScope ?? DEFAULT_PLATFORM_SCOPE,
      accessLevel: entry?.accessLevel ?? DEFAULT_ACCESS_LEVEL,
    }
  })
}

/**
 * Resolves the id of a freshly created role. The Go endpoint is used rather than
 * the Java list because Java hides super-admin and org-admin roles.
 */
async function resolveRoleIdByName(name: string): Promise<number | undefined> {
  const wanted = name.trim().toLowerCase()
  const matrix = await fetchRoleMatrix()
  return matrix.find((entry) => entry.name.trim().toLowerCase() === wanted)?.id
}

/**
 * Saves a role across both backends: name, description and legacy permissions go
 * to the Java console, then the platform scope and access level go to the Go
 * server, which owns those two columns.
 */
export async function saveRoleWithMatrix(input: SaveRoleInput): Promise<void> {
  const { platformScope, accessLevel, ...role } = input

  await upsertRole(role)

  try {
    const roleId = role.id ?? (await resolveRoleIdByName(role.name))
    if (roleId == null) {
      throw new Error(`role "${role.name}" not found after save`)
    }
    await updateRoleMatrix(roleId, { platformScope, accessLevel })
  } catch (cause) {
    throw new RoleMatrixNotPersistedError(role.name, { cause })
  }
}
