import { useQuery } from '@tanstack/react-query'
import {
  fetchPublicDeviceInfo,
  formatPublicLastSync,
} from '@/features/devices/api/public-device-info-api'

export function usePublicDeviceInfoQuery(deviceId: string) {
  return useQuery({
    queryKey: ['public-device-info', deviceId],
    queryFn: () => fetchPublicDeviceInfo(deviceId),
    enabled: deviceId.trim().length > 0,
    retry: false,
  })
}

export { formatPublicLastSync }
