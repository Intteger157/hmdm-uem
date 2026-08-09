import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createWindowsGroup,
  deleteWindowsGroup,
  fetchWindowsGroups,
  updateWindowsGroup,
} from '@/features/windows/groups/api/windows-groups-api'
import type { UpsertWindowsGroupPayload } from '@/features/windows/groups/types/windows-group'
import { windowsConfigProfileQueryKeys, windowsDeviceGroupQueryKeys } from '@/features/windows/configurations/hooks/use-windows-config-profiles'

export const windowsGroupsQueryKeys = {
  all: ['windows-groups'] as const,
  list: () => [...windowsGroupsQueryKeys.all, 'list'] as const,
}

export function useWindowsGroupsQuery(enabled = true) {
  return useQuery({
    queryKey: windowsGroupsQueryKeys.list(),
    queryFn: async () => {
      const response = await fetchWindowsGroups()
      return response.items
    },
    enabled,
  })
}

function invalidateGroupQueries(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: windowsGroupsQueryKeys.list() })
  void queryClient.invalidateQueries({ queryKey: windowsDeviceGroupQueryKeys.list() })
}

export function useCreateWindowsGroupMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: UpsertWindowsGroupPayload) => createWindowsGroup(payload),
    onSuccess: () => {
      invalidateGroupQueries(queryClient)
    },
  })
}

export function useUpdateWindowsGroupMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpsertWindowsGroupPayload }) =>
      updateWindowsGroup(id, payload),
    onSuccess: () => {
      invalidateGroupQueries(queryClient)
      void queryClient.invalidateQueries({ queryKey: windowsConfigProfileQueryKeys.all })
    },
  })
}

export function useDeleteWindowsGroupMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteWindowsGroup(id),
    onSuccess: () => {
      invalidateGroupQueries(queryClient)
      void queryClient.invalidateQueries({ queryKey: windowsConfigProfileQueryKeys.all })
    },
  })
}
