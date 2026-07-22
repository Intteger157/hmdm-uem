import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  deleteApplication,
  fetchApplications,
  upsertAndroidApplication,
} from '@/features/applications/api/applications-api'
import type { Application } from '@/features/applications/api/applications-api'

export const applicationQueryKeys = {
  all: ['applications'] as const,
  list: () => [...applicationQueryKeys.all, 'list'] as const,
}

export function useApplicationsQuery() {
  return useQuery({
    queryKey: applicationQueryKeys.list(),
    queryFn: fetchApplications,
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
