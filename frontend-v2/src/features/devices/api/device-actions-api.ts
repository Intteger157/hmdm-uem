import { api } from '@/shared/api/client'
import { sendPushMessage } from '@/features/plugins/push/api/push-api'
import type { ApiResponse } from '@/shared/api/types/api-response'
import { unwrapApiResponse } from '@/shared/api/types/api-response'

export async function sendDeviceConfigSync(deviceNumber: string): Promise<void> {
  await sendPushMessage({
    scope: 'device',
    deviceNumber,
    messageType: 'configUpdated',
  })
}

export async function requestDeviceReboot(deviceId: number): Promise<void> {
  const response = await api.put<ApiResponse<unknown>>('/plugins/devicereset/private/reboot', {
    deviceId,
  })
  unwrapApiResponse(response.data)
}

export async function requestDeviceFactoryReset(deviceId: number): Promise<void> {
  const response = await api.put<ApiResponse<unknown>>('/plugins/devicereset/private/reset', {
    deviceId,
  })
  unwrapApiResponse(response.data)
}
