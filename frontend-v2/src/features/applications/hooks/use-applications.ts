import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  deleteApplication,
  deleteApplicationVersion,
  fetchApplicationById,
  fetchApplicationConfigurations,
  fetchApplicationVersions,
  fetchApplications,
  updateApplicationConfigurations,
  upsertAndroidApplication,
} from '@/features/applications/api/applications-api'
import type {
  Application,
  ApplicationConfigurationLink,
} from '@/features/applications/api/applications-api'

export const applicationQueryKeys = {
  all: ['applications'] as const,
  list: () => [...applicationQueryKeys.all, 'list'] as const,
  detail: (id: number) => [...applicationQueryKeys.all, 'detail', id] as const,
  versions: (id: number) => [...applicationQueryKeys.all, 'versions', id] as const,
  configurations: (id: number) => [...applicationQueryKeys.all, 'configurations', id] as const,
}

export function useApplicationsQuery() {
  return useQuery({
    queryKey: applicationQueryKeys.list(),
    queryFn: fetchApplications,
  })
}

export function useApplicationQuery(id: number | undefined) {
  return useQuery({
    queryKey: applicationQueryKeys.detail(id ?? 0),
    queryFn: () => fetchApplicationById(id!),
    enabled: id != null && id > 0,
  })
}

export function useApplicationVersionsQuery(applicationId: number | undefined) {
  return useQuery({
    queryKey: applicationQueryKeys.versions(applicationId ?? 0),
    queryFn: () => fetchApplicationVersions(applicationId!),
    enabled: applicationId != null && applicationId > 0,
  })
}

export function useUpsertApplicationMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (application: Application) => upsertAndroidApplication(application),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: applicationQueryKeys.all })
    },
  })
}

export function useDeleteApplicationMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => deleteApplication(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: applicationQueryKeys.all })
    },
  })
}

export function useDeleteApplicationVersionMutation(applicationId: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (versionId: number) => deleteApplicationVersion(versionId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: applicationQueryKeys.all })
      await queryClient.invalidateQueries({
        queryKey: applicationQueryKeys.versions(applicationId),
      })
    },
  })
}

export function useApplicationConfigurationsQuery(applicationId: number | undefined) {
  return useQuery({
    queryKey: applicationQueryKeys.configurations(applicationId ?? 0),
    queryFn: () => fetchApplicationConfigurations(applicationId!),
    enabled: applicationId != null && applicationId > 0,
  })
}

export function useUpdateApplicationConfigurationsMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request: {
      applicationId: number
      configurations: ApplicationConfigurationLink[]
    }) => updateApplicationConfigurations(request),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({
        queryKey: applicationQueryKeys.configurations(variables.applicationId),
      })
      await queryClient.invalidateQueries({ queryKey: applicationQueryKeys.all })
    },
  })
}
