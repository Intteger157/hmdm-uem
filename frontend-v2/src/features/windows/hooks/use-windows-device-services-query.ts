import { useQuery } from '@tanstack/react-query'
import { getWindowsDeviceServices } from '@/features/windows/api/windows-api'
import {
  windowsDeviceDetailQueryKeys,
  windowsDevicePollingQueryOptions,
} from '@/features/windows/hooks/windows-device-detail-query-keys'

export function useWindowsDeviceServicesQuery(hardwareId: string, enabled = true) {
  return useQuery({
    queryKey: windowsDeviceDetailQueryKeys.services(hardwareId),
    queryFn: () => getWindowsDeviceServices(hardwareId),
    enabled: hardwareId.length > 0 && enabled,
    ...windowsDevicePollingQueryOptions,
  })
}
