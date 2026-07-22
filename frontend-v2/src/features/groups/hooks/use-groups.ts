import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { deleteGroup, fetchGroups, upsertGroup } from '@/features/groups/api/groups-api'
import type { DeviceGroup } from '@/features/groups/api/groups-api'

export const groupQueryKeys = {
  all: ['groups'] as const,
  list: () => [...groupQueryKeys.all, 'list'] as const,
}

export function useGroupsQuery() {
  return useQuery({
    queryKey: groupQueryKeys.list(),
    queryFn: fetchGroups,
  })
}

export function useUpsertGroupMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (group: DeviceGroup) => upsertGroup(group),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: groupQueryKeys.all })
    },
  })
}

export function useDeleteGroupMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => deleteGroup(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: groupQueryKeys.all })
    },
  })
}
