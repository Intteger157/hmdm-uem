import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  assignProfileFileDeployments,
  deleteStoredFile,
  fetchProfileFileDeployments,
  fetchStoredFiles,
  uploadStoredFile,
} from '@/features/windows/files/api/windows-files-api'
import type { ProfileFileDeploymentRule } from '@/features/windows/files/types/stored-file'

export const windowsFilesQueryKeys = {
  all: ['windows-files'] as const,
  list: () => [...windowsFilesQueryKeys.all, 'list'] as const,
  profileDeployments: (profileId: number) =>
    [...windowsFilesQueryKeys.all, 'profile-deployments', profileId] as const,
}

export function useStoredFilesQuery(enabled = true) {
  return useQuery({
    queryKey: windowsFilesQueryKeys.list(),
    queryFn: fetchStoredFiles,
    enabled,
  })
}

export function useUploadStoredFileMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ file, onUploadProgress }: { file: File; onUploadProgress?: (progress: import('@/features/windows/applications/utils/installer-upload').UploadProgressState) => void }) =>
      uploadStoredFile(file, { onUploadProgress }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: windowsFilesQueryKeys.list() })
    },
  })
}

export function useDeleteStoredFileMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, force }: { id: number; force?: boolean }) => deleteStoredFile(id, { force }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: windowsFilesQueryKeys.list() })
    },
  })
}

export function useProfileFileDeploymentsQuery(profileId: number | null, enabled = true) {
  return useQuery({
    queryKey: windowsFilesQueryKeys.profileDeployments(profileId ?? 0),
    queryFn: () => fetchProfileFileDeployments(profileId!),
    enabled: profileId != null && profileId > 0 && enabled,
  })
}

export function useAssignProfileFileDeploymentsMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      profileId,
      items,
    }: {
      profileId: number
      items: ProfileFileDeploymentRule[]
    }) => assignProfileFileDeployments(profileId, items),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({
        queryKey: windowsFilesQueryKeys.profileDeployments(variables.profileId),
      })
    },
  })
}
