import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  assignConfigProfileApps,
  assignDeviceApp,
  createSoftwareApp,
  deleteSoftwareApp,
  fetchConfigProfileApps,
  fetchDeviceAppStatuses,
  fetchSoftwareApps,
  updateSoftwareApp,
} from '@/features/windows/applications/api/windows-applications-api'
import type { UpsertSoftwareAppPayload } from '@/features/windows/applications/types/software-app'

export const windowsSoftwareAppQueryKeys = {
  all: ['windows-software-apps'] as const,
  list: () => [...windowsSoftwareAppQueryKeys.all, 'list'] as const,
  profileApps: (profileId: number) => [...windowsSoftwareAppQueryKeys.all, 'profile', profileId] as const,
  deviceStatuses: (hardwareId: string) => [...windowsSoftwareAppQueryKeys.all, 'device', hardwareId] as const,
}

export function useSoftwareAppsQuery(enabled = true) {
  return useQuery({
    queryKey: windowsSoftwareAppQueryKeys.list(),
    queryFn: async () => {
      const response = await fetchSoftwareApps()
      return response.items
    },
    enabled,
  })
}

export function useUpsertSoftwareAppMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, payload }: { id?: number; payload: UpsertSoftwareAppPayload }) =>
      id != null ? updateSoftwareApp(id, payload) : createSoftwareApp(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: windowsSoftwareAppQueryKeys.all })
    },
  })
}

export function useDeleteSoftwareAppMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => deleteSoftwareApp(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: windowsSoftwareAppQueryKeys.all })
    },
  })
}

export function useConfigProfileAppsQuery(profileId: number | null, enabled = true) {
  return useQuery({
    queryKey: windowsSoftwareAppQueryKeys.profileApps(profileId ?? 0),
    queryFn: () => fetchConfigProfileApps(profileId!),
    enabled: profileId != null && profileId > 0 && enabled,
  })
}

export function useAssignConfigProfileAppsMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ profileId, appIds }: { profileId: number; appIds: number[] }) =>
      assignConfigProfileApps(profileId, appIds),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: windowsSoftwareAppQueryKeys.all })
      await queryClient.invalidateQueries({
        queryKey: windowsSoftwareAppQueryKeys.profileApps(variables.profileId),
      })
    },
  })
}

export function useDeviceAppStatusesQuery(hardwareId: string, enabled = true) {
  return useQuery({
    queryKey: windowsSoftwareAppQueryKeys.deviceStatuses(hardwareId),
    queryFn: () => fetchDeviceAppStatuses(hardwareId),
    enabled: hardwareId.length > 0 && enabled,
    refetchInterval: 15_000,
  })
}

export function useAssignDeviceAppMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ hardwareId, appId }: { hardwareId: string; appId: number }) =>
      assignDeviceApp(hardwareId, appId),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({
        queryKey: windowsSoftwareAppQueryKeys.deviceStatuses(variables.hardwareId),
      })
    },
  })
}
