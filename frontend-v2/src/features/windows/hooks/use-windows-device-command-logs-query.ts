import { useQuery } from '@tanstack/react-query'
import { getWindowsDeviceCommandLogs } from '@/features/windows/api/windows-api'
import {
  windowsDeviceDetailQueryKeys,
  windowsDevicePollingQueryOptions,
} from '@/features/windows/hooks/windows-device-detail-query-keys'

export function useWindowsDeviceCommandLogsQuery(hardwareId: string, enabled = true) {
  return useQuery({
    queryKey: windowsDeviceDetailQueryKeys.commandLogs(hardwareId),
    queryFn: () => getWindowsDeviceCommandLogs(hardwareId),
    enabled: hardwareId.length > 0 && enabled,
    ...windowsDevicePollingQueryOptions,
  })
}
