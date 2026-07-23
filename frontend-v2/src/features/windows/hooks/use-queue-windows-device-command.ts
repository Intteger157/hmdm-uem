import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  queueWindowsDeviceCommand,
  type WindowsDeviceCommandName,
} from '@/features/windows/api/windows-api'
import { deviceByNumberQueryKeys } from '@/features/devices/hooks/use-device-by-number-query'
import { deviceQueryKeys } from '@/features/devices/hooks/use-devices-query'
import { windowsDeviceDetailQueryKeys } from '@/features/windows/hooks/windows-device-detail-query-keys'

export function useQueueWindowsDeviceCommandMutation(hardwareId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      commandName,
      payload,
    }: {
      commandName: WindowsDeviceCommandName
      payload: string
    }) => queueWindowsDeviceCommand(hardwareId, commandName, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: windowsDeviceDetailQueryKeys.commandLogs(hardwareId),
      })
      await queryClient.invalidateQueries({
        queryKey: deviceByNumberQueryKeys.detail('windows', hardwareId),
      })
      await queryClient.invalidateQueries({ queryKey: deviceQueryKeys.all })
    },
  })
}
