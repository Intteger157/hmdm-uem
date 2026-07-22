import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  deleteRole,
  fetchRolePermissions,
  fetchRoles,
  upsertRole,
  type UserRole,
} from '@/features/roles/api/roles-api'

export const rolesQueryKeys = {
  all: ['roles'] as const,
  list: () => [...rolesQueryKeys.all, 'list'] as const,
  permissions: () => [...rolesQueryKeys.all, 'permissions'] as const,
}

export function useRolesQuery() {
  return useQuery({
    queryKey: rolesQueryKeys.list(),
    queryFn: fetchRoles,
  })
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
    mutationFn: (role: UserRole) => upsertRole(role),
    onSuccess: async () => {
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
