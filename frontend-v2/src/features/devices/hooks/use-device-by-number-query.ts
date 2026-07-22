import { useQuery } from '@tanstack/react-query'
import { getDeviceByNumber } from '@/features/devices/api/devices-api'

export const deviceByNumberQueryKeys = {
  detail: (number: string) => ['devices', 'by-number', number] as const,
}

export function useDeviceByNumber(number: string) {
  return useQuery({
    queryKey: deviceByNumberQueryKeys.detail(number),
    queryFn: () => getDeviceByNumber(number),
    enabled: number.length > 0,
  })
}
