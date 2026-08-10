import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createWindowsGroup,
  deleteWindowsGroup,
  fetchWindowsGroup,
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

export function useWindowsGroupDetailQuery(groupId: number | null, enabled = true) {
  return useQuery({
    queryKey: [...windowsGroupsQueryKeys.all, 'detail', groupId ?? 0],
    queryFn: () => fetchWindowsGroup(groupId as number),
    enabled: enabled && groupId != null && groupId > 0,
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
