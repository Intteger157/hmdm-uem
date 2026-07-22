import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  deleteFile,
  fetchFileConfigurations,
  fetchFiles,
  fetchFileStorageLimit,
  updateFile,
  updateFileConfigurations,
  type FileConfigurationLink,
  type FileEntry,
} from '@/features/files/api/files-api'

export const fileQueryKeys = {
  all: ['files'] as const,
  list: (search?: string) => [...fileQueryKeys.all, 'list', search ?? ''] as const,
  limit: () => [...fileQueryKeys.all, 'limit'] as const,
  configurations: (fileId: number) => [...fileQueryKeys.all, 'configurations', fileId] as const,
}

export function useFilesQuery(search = '') {
  return useQuery({
    queryKey: fileQueryKeys.list(search),
    queryFn: () => fetchFiles(search),
  })
}

export function useFileStorageLimitQuery(enabled = true) {
  return useQuery({
    queryKey: fileQueryKeys.limit(),
    queryFn: fetchFileStorageLimit,
    enabled,
  })
}

export function useFileConfigurationsQuery(fileId: number | undefined) {
  return useQuery({
    queryKey: fileQueryKeys.configurations(fileId ?? 0),
    queryFn: () => fetchFileConfigurations(fileId!),
    enabled: fileId != null && fileId > 0,
  })
}

export function useDeleteFileMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (file: FileEntry) => deleteFile(file),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: fileQueryKeys.all })
    },
  })
}

export function useUpdateFileMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (file: FileEntry) => updateFile(file),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: fileQueryKeys.all })
    },
  })
}

export function useUpdateFileConfigurationsMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request: { fileId: number; configurations: FileConfigurationLink[] }) =>
      updateFileConfigurations(request),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: fileQueryKeys.all })
      await queryClient.invalidateQueries({
        queryKey: fileQueryKeys.configurations(variables.fileId),
      })
    },
  })
}
