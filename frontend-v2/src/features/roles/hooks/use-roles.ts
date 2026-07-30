import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  deleteRole,
  fetchRolePermissions,
  fetchRoles,
} from '@/features/roles/api/roles-api'
import { fetchRoleMatrix } from '@/features/roles/api/role-matrix-api'
import {
  mergeRoleMatrix,
  saveRoleWithMatrix,
  type RoleWithMatrix,
  type SaveRoleInput,
} from '@/features/roles/lib/role-matrix'

export const rolesQueryKeys = {
  all: ['roles'] as const,
  list: () => [...rolesQueryKeys.all, 'list'] as const,
  matrix: () => [...rolesQueryKeys.all, 'matrix'] as const,
  permissions: () => [...rolesQueryKeys.all, 'permissions'] as const,
}

export function useRolesQuery() {
  return useQuery({
    queryKey: rolesQueryKeys.list(),
    queryFn: fetchRoles,
  })
}

export function useRoleMatrixQuery() {
  return useQuery({
    queryKey: rolesQueryKeys.matrix(),
    queryFn: fetchRoleMatrix,
    retry: false,
  })
}

/**
 * Presents the roles page with a single list even though the data comes from two
 * backends: the Java console owns the roles, the Go server owns their platform
 * scope and access level.
 *
 * A Go matrix outage must not hide the Java role list — missing matrix rows fall
 * back to global/high defaults until the Go API recovers.
 */
export function useRolesWithMatrixQuery(): {
  roles: RoleWithMatrix[]
  isLoading: boolean
  error: unknown
  matrixError: unknown
  refetch: () => Promise<unknown>
} {
  const rolesQuery = useRolesQuery()
  const matrixQuery = useRoleMatrixQuery()

  const roles = useMemo(
    () => mergeRoleMatrix(rolesQuery.data, matrixQuery.isError ? undefined : matrixQuery.data),
    [rolesQuery.data, matrixQuery.data, matrixQuery.isError],
  )

  return {
    roles,
    isLoading: rolesQuery.isLoading,
    error: rolesQuery.error,
    matrixError: matrixQuery.error,
    refetch: () => Promise.all([rolesQuery.refetch(), matrixQuery.refetch()]),
  }
}

export function useRolePermissionsQuery() {
  return useQuery({
    queryKey: rolesQueryKeys.permissions(),
    queryFn: fetchRolePermissions,
  })
}

export function useUpsertRoleMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (role: SaveRoleInput) => saveRoleWithMatrix(role),
    onSettled: async () => {
      // Invalidate even on failure: the Java half of the save may have landed.
      await queryClient.invalidateQueries({ queryKey: rolesQueryKeys.all })
    },
  })
}

export function useDeleteRoleMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteRole(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: rolesQueryKeys.all })
    },
  })
}
