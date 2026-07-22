import { useMutation, useQueryClient } from '@tanstack/react-query'
import { deleteDevice, upsertDevice } from '@/features/devices/api/devices-api'
import { deviceQueryKeys } from '@/features/devices/hooks/use-devices-query'
import type { DeviceUpsertPayload } from '@/shared/api/types/device'

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
    mutationFn: (id: number) => deleteDevice(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: deviceQueryKeys.all })
    },
  })
}
