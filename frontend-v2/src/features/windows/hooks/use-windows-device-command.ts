import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  sendWindowsDeviceCommand,
  type WindowsCommandAction,
  type WindowsCommandPayload,
} from '@/features/windows/api/windows-api'
import { deviceByNumberQueryKeys } from '@/features/devices/hooks/use-device-by-number-query'

export function useWindowsDeviceCommandMutation(hardwareId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      action,
      payload,
    }: {
      action: WindowsCommandAction
      payload?: WindowsCommandPayload
    }) => sendWindowsDeviceCommand(hardwareId, action, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: deviceByNumberQueryKeys.detail('windows', hardwareId),
      })
    },
  })
}
