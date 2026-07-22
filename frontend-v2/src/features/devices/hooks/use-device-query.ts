import { useQuery } from '@tanstack/react-query'
import { getDeviceById } from '@/features/devices/api/devices-api'

export const deviceQueryKeys = {
  detail: (id: number) => ['devices', 'detail', id] as const,
}

export function useDeviceQuery(id: number) {
  return useQuery({
    queryKey: deviceQueryKeys.detail(id),
    queryFn: () => getDeviceById(id),
    enabled: id > 0,
  })
}
