import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  deleteUser,
  fetchUserRoles,
  fetchUsers,
  upsertUser,
} from '@/features/users/api/users-api'
import type { UserUpsertInput } from '@/features/users/api/users-api'

export const userQueryKeys = {
  all: ['users'] as const,
  list: () => [...userQueryKeys.all, 'list'] as const,
  roles: () => [...userQueryKeys.all, 'roles'] as const,
}

export function useUsersQuery() {
  return useQuery({
    queryKey: userQueryKeys.list(),
    queryFn: fetchUsers,
  })
}

export function useUserRolesQuery(enabled = true) {
  return useQuery({
    queryKey: userQueryKeys.roles(),
    queryFn: fetchUserRoles,
    enabled,
    staleTime: 10 * 60_000,
  })
}

export function useUpsertUserMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: UserUpsertInput) => upsertUser(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: userQueryKeys.all })
    },
  })
}

export function useDeleteUserMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => deleteUser(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: userQueryKeys.all })
    },
  })
}
