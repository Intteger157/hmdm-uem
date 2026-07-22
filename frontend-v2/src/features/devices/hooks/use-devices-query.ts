import { useQuery } from '@tanstack/react-query'
import { searchDevices } from '@/features/devices/api/devices-api'
import type { DeviceSearchParams } from '@/shared/api/types/device'

export const deviceQueryKeys = {
  all: ['devices'] as const,
  list: (params: DeviceSearchParams) => [...deviceQueryKeys.all, 'list', params] as const,
}

const DEVICES_POLL_INTERVAL_MS = 60_000

export function useDevicesQuery(params: DeviceSearchParams) {
  return useQuery({
    queryKey: deviceQueryKeys.list(params),
    queryFn: () => searchDevices(params),
    placeholderData: (previous) => previous,
    refetchInterval: DEVICES_POLL_INTERVAL_MS,
  })
}
