import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  copyConfiguration,
  deleteConfiguration,
  fetchConfigurationApplications,
  fetchConfigurationById,
  fetchConfigurations,
  upgradeConfigurationApplication,
  upsertConfiguration,
} from '@/features/configurations/api/configurations-api'
import type {
  Configuration,
  ConfigurationCopyRequest,
  UpgradeConfigurationApplicationRequest,
} from '@/features/configurations/api/configurations-api'

export const configurationQueryKeys = {
  all: ['configurations'] as const,
  list: () => [...configurationQueryKeys.all, 'list'] as const,
  detail: (id: number) => [...configurationQueryKeys.all, 'detail', id] as const,
  applications: (id: number) => [...configurationQueryKeys.all, 'applications', id] as const,
}

export function useConfigurationsQuery() {
  return useQuery({
    queryKey: configurationQueryKeys.list(),
    queryFn: fetchConfigurations,
  })
}

export function useConfigurationQuery(id: number | undefined) {
  return useQuery({
    queryKey: configurationQueryKeys.detail(id ?? 0),
    queryFn: () => fetchConfigurationById(id!),
    enabled: id != null && id > 0,
  })
}

export function useConfigurationApplicationsQuery(configId: number | undefined) {
  return useQuery({
    queryKey: configurationQueryKeys.applications(configId ?? 0),
    queryFn: () => fetchConfigurationApplications(configId!),
    enabled: configId != null && configId > 0,
  })
}

export function useUpsertConfigurationMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (configuration: Configuration) => upsertConfiguration(configuration),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: configurationQueryKeys.all })
    },
  })
}

export function useCopyConfigurationMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request: ConfigurationCopyRequest) => copyConfiguration(request),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: configurationQueryKeys.all })
    },
  })
}

export function useDeleteConfigurationMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => deleteConfiguration(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: configurationQueryKeys.all })
    },
  })
}

export function useUpgradeConfigurationApplicationMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request: UpgradeConfigurationApplicationRequest) =>
      upgradeConfigurationApplication(request),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: configurationQueryKeys.all })
      await queryClient.invalidateQueries({
        queryKey: configurationQueryKeys.applications(variables.configurationId),
      })
    },
  })
}
