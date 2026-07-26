import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createPowerShellScript,
  deletePowerShellScript,
  fetchPowerShellScripts,
  updatePowerShellScript,
} from '@/features/windows/scripts/api/windows-scripts-api'
import type { UpsertPowerShellScriptPayload } from '@/features/windows/scripts/types/powershell-script'

export const windowsScriptsQueryKeys = {
  all: ['windows-powershell-scripts'] as const,
  list: () => [...windowsScriptsQueryKeys.all, 'list'] as const,
}

export function usePowerShellScriptsQuery(enabled = true) {
  return useQuery({
    queryKey: windowsScriptsQueryKeys.list(),
    queryFn: fetchPowerShellScripts,
    enabled,
  })
}

export function useCreatePowerShellScriptMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createPowerShellScript,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: windowsScriptsQueryKeys.list() })
    },
  })
}

export function useUpdatePowerShellScriptMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpsertPowerShellScriptPayload }) =>
      updatePowerShellScript(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: windowsScriptsQueryKeys.list() })
    },
  })
}

export function useDeletePowerShellScriptMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deletePowerShellScript,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: windowsScriptsQueryKeys.list() })
    },
  })
}
