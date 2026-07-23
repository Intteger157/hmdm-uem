import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  assignWindowsConfigProfile,
  createWindowsConfigProfile,
  deleteWindowsConfigProfile,
  fetchWindowsConfigProfileAssignments,
  fetchWindowsConfigProfileById,
  fetchWindowsConfigProfiles,
  fetchWindowsDeviceEffectiveConfig,
  fetchWindowsDeviceGroups,
  updateWindowsConfigProfile,
} from '@/features/windows/configurations/api/windows-configurations-api'
import type { UpsertWindowsConfigProfilePayload, WindowsConfigProfileAssignments } from '@/features/windows/configurations/types/config-profile'

export const windowsConfigProfileQueryKeys = {
  all: ['windows-config-profiles'] as const,
  list: () => [...windowsConfigProfileQueryKeys.all, 'list'] as const,
  detail: (id: number) => [...windowsConfigProfileQueryKeys.all, 'detail', id] as const,
  assignments: (id: number) => [...windowsConfigProfileQueryKeys.all, 'assignments', id] as const,
}

export const windowsDeviceGroupQueryKeys = {
  all: ['windows-device-groups'] as const,
  list: () => [...windowsDeviceGroupQueryKeys.all, 'list'] as const,
}

export const windowsEffectiveConfigQueryKeys = {
  all: ['windows-effective-config'] as const,
  detail: (hardwareId: string) => [...windowsEffectiveConfigQueryKeys.all, hardwareId] as const,
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

export function useWindowsConfigProfileAssignmentsQuery(profileId: number | null, enabled = true) {
  return useQuery({
    queryKey: windowsConfigProfileQueryKeys.assignments(profileId ?? 0),
    queryFn: () => fetchWindowsConfigProfileAssignments(profileId!),
    enabled: profileId != null && profileId > 0 && enabled,
  })
}

export function useWindowsDeviceGroupsQuery(enabled = true) {
  return useQuery({
    queryKey: windowsDeviceGroupQueryKeys.list(),
    queryFn: async () => {
      const response = await fetchWindowsDeviceGroups()
      return response.items
    },
    enabled,
  })
}

export function useAssignWindowsConfigProfileMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      profileId,
      assignments,
    }: {
      profileId: number
      assignments: WindowsConfigProfileAssignments
    }) => assignWindowsConfigProfile(profileId, assignments),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: windowsConfigProfileQueryKeys.all })
      await queryClient.invalidateQueries({
        queryKey: windowsConfigProfileQueryKeys.assignments(variables.profileId),
      })
      await queryClient.invalidateQueries({ queryKey: windowsEffectiveConfigQueryKeys.all })
    },
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

export function useWindowsDeviceEffectiveConfigQuery(hardwareId: string, enabled = true) {
  return useQuery({
    queryKey: windowsEffectiveConfigQueryKeys.detail(hardwareId),
    queryFn: () => fetchWindowsDeviceEffectiveConfig(hardwareId),
    enabled: hardwareId.length > 0 && enabled,
  })
}
