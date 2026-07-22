import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { deleteFile, fetchFiles } from '@/features/files/api/files-api'
import type { FileEntry } from '@/features/files/api/files-api'

export const fileQueryKeys = {
  all: ['files'] as const,
  list: () => [...fileQueryKeys.all, 'list'] as const,
}

export function useFilesQuery() {
  return useQuery({
    queryKey: fileQueryKeys.list(),
    queryFn: fetchFiles,
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
