import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  assignConfigProfileApps,
  assignDeviceApp,
  createApplicationVersion,
  createSoftwareApp,
  deleteSoftwareApp,
  fetchConfigProfileApps,
  fetchDeviceAppStatuses,
  fetchSoftwareApp,
  fetchSoftwareApps,
  updateSoftwareApp,
} from '@/features/windows/applications/api/windows-applications-api'
import type {
  AssignDeviceAppPayload,
  CreateApplicationPayload,
  CreateApplicationVersionPayload,
  ProfileAppsPayload,
  UpdateApplicationPayload,
} from '@/features/windows/applications/types/software-app'

export const windowsSoftwareAppQueryKeys = {
  all: ['windows-software-apps'] as const,
  list: () => [...windowsSoftwareAppQueryKeys.all, 'list'] as const,
  detail: (id: number) => [...windowsSoftwareAppQueryKeys.all, 'detail', id] as const,
  profileApps: (profileId: number) => [...windowsSoftwareAppQueryKeys.all, 'profile', profileId] as const,
  deviceStatuses: (hardwareId: string) => [...windowsSoftwareAppQueryKeys.all, 'device', hardwareId] as const,
}

export function useSoftwareAppsQuery(enabled = true) {
  return useQuery({
    queryKey: windowsSoftwareAppQueryKeys.list(),
    queryFn: fetchSoftwareApps,
    enabled,
  })
}

export function useSoftwareAppQuery(id: number | null, enabled = true) {
  return useQuery({
    queryKey: windowsSoftwareAppQueryKeys.detail(id ?? 0),
    queryFn: () => fetchSoftwareApp(id as number),
    enabled: enabled && id != null && id > 0,
  })
}

export function useCreateSoftwareAppMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateApplicationPayload) => createSoftwareApp(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: windowsSoftwareAppQueryKeys.all })
    },
  })
}

export function useUpdateSoftwareAppMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateApplicationPayload }) =>
      updateSoftwareApp(id, payload),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: windowsSoftwareAppQueryKeys.all })
      await queryClient.invalidateQueries({ queryKey: windowsSoftwareAppQueryKeys.detail(variables.id) })
    },
  })
}

export function useCreateApplicationVersionMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ appId, payload }: { appId: number; payload: CreateApplicationVersionPayload }) =>
      createApplicationVersion(appId, payload),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: windowsSoftwareAppQueryKeys.all })
      await queryClient.invalidateQueries({ queryKey: windowsSoftwareAppQueryKeys.detail(variables.appId) })
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
    queryFn: () => fetchConfigProfileApps(profileId as number),
    enabled: enabled && profileId != null && profileId > 0,
  })
}

export function useAssignConfigProfileAppsMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ profileId, payload }: { profileId: number; payload: ProfileAppsPayload }) =>
      assignConfigProfileApps(profileId, payload),
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
    enabled: enabled && hardwareId.trim() !== '',
    refetchInterval: 15_000,
  })
}

export function useAssignDeviceAppMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      hardwareId,
      appId,
      payload,
    }: {
      hardwareId: string
      appId: number
      payload?: AssignDeviceAppPayload
    }) => assignDeviceApp(hardwareId, appId, payload),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({
        queryKey: windowsSoftwareAppQueryKeys.deviceStatuses(variables.hardwareId),
      })
    },
  })
}
