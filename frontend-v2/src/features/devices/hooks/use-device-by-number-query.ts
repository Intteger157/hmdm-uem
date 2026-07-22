import { useQuery } from '@tanstack/react-query'
import { getDeviceByNumber } from '@/features/devices/api/devices-api'
import { getWindowsDeviceByHardwareId } from '@/features/windows/api/windows-api'
import type { Platform } from '@/shared/api/types/platform'

export const deviceByNumberQueryKeys = {
  detail: (platform: Platform, number: string) => ['devices', 'by-number', platform, number] as const,
}

const DEVICE_DETAIL_POLL_INTERVAL_MS = 60_000

export function useDeviceByNumber(number: string, platform: Platform = 'android') {
  const queryFn =
    platform === 'windows'
      ? () => getWindowsDeviceByHardwareId(number)
      : () => getDeviceByNumber(number)

  return useQuery({
    queryKey: deviceByNumberQueryKeys.detail(platform, number),
    queryFn,
    enabled: number.length > 0,
    refetchInterval: DEVICE_DETAIL_POLL_INTERVAL_MS,
  })
}
