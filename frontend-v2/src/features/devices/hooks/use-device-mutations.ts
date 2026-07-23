import { useMutation, useQueryClient } from '@tanstack/react-query'
import { deleteDevice, upsertDevice } from '@/features/devices/api/devices-api'
import { deleteWindowsDevice } from '@/features/windows/api/windows-api'
import { deviceQueryKeys } from '@/features/devices/hooks/use-devices-query'
import type { DeviceUpsertPayload, DeviceView } from '@/shared/api/types/device'

export function useUpsertDeviceMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: DeviceUpsertPayload) => upsertDevice(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: deviceQueryKeys.all })
    },
  })
}

export function useDeleteDeviceMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (device: DeviceView) => {
      if (device.platform === 'windows') {
        await deleteWindowsDevice(device.number)
        return
      }
      await deleteDevice(device.id)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: deviceQueryKeys.all })
    },
  })
}
