import { useMutation } from '@tanstack/react-query'
import {
  sendWindowsDeviceCommand,
  type WindowsCommandAction,
  type WindowsCommandPayload,
} from '@/features/windows/api/windows-api'

export function useWindowsDeviceCommandMutation(hardwareId: string) {
  return useMutation({
    mutationFn: ({
      action,
      payload,
    }: {
      action: WindowsCommandAction
      payload?: WindowsCommandPayload
    }) => sendWindowsDeviceCommand(hardwareId, action, payload),
  })
}
