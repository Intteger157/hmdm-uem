import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createWindowsConfigProfile,
  deleteWindowsConfigProfile,
  fetchWindowsConfigProfileById,
  fetchWindowsConfigProfiles,
  updateWindowsConfigProfile,
} from '@/features/windows/configurations/api/windows-configurations-api'
import type { UpsertWindowsConfigProfilePayload } from '@/features/windows/configurations/types/config-profile'

export const windowsConfigProfileQueryKeys = {
  all: ['windows-config-profiles'] as const,
  list: () => [...windowsConfigProfileQueryKeys.all, 'list'] as const,
  detail: (id: number) => [...windowsConfigProfileQueryKeys.all, 'detail', id] as const,
}

export function useWindowsConfigProfilesQuery() {
  return useQuery({
    queryKey: windowsConfigProfileQueryKeys.list(),
    queryFn: async () => {
      const response = await fetchWindowsConfigProfiles()
      return response.items
    },
  })
}

export function useWindowsConfigProfileQuery(id: number | null, enabled = true) {
  return useQuery({
    queryKey: windowsConfigProfileQueryKeys.detail(id ?? 0),
    queryFn: () => fetchWindowsConfigProfileById(id!),
    enabled: id != null && id > 0 && enabled,
  })
}

export function useUpsertWindowsConfigProfileMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id?: number
      payload: UpsertWindowsConfigProfilePayload
    }) => (id != null ? updateWindowsConfigProfile(id, payload) : createWindowsConfigProfile(payload)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: windowsConfigProfileQueryKeys.all })
    },
  })
}

export function useDeleteWindowsConfigProfileMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => deleteWindowsConfigProfile(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: windowsConfigProfileQueryKeys.all })
    },
  })
}
