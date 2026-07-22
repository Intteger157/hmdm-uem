import { useMutation } from '@tanstack/react-query'
import {
  requestDeviceFactoryReset,
  requestDeviceReboot,
  sendDeviceConfigSync,
} from '@/features/devices/api/device-actions-api'
import { sendMessagingMessage } from '@/features/plugins/messaging/api/messaging-api'

export function useDeviceConfigSyncMutation() {
  return useMutation({
    mutationFn: (deviceNumber: string) => sendDeviceConfigSync(deviceNumber),
  })
}

export function useDeviceRebootMutation() {
  return useMutation({
    mutationFn: (deviceId: number) => requestDeviceReboot(deviceId),
  })
}

export function useDeviceFactoryResetMutation() {
  return useMutation({
    mutationFn: (deviceId: number) => requestDeviceFactoryReset(deviceId),
  })
}

export function useDeviceMessageMutation() {
  return useMutation({
    mutationFn: ({ deviceNumber, message }: { deviceNumber: string; message: string }) =>
      sendMessagingMessage({
        scope: 'device',
        deviceNumber,
        message,
      }),
  })
}
