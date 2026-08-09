import { useDevicesQuery } from '@/features/devices/hooks/use-devices-query'
import { usePermissions } from '@/features/auth/hooks/use-permissions'
import type { Platform } from '@/shared/api/types/platform'

export function useDashboardFleetDevices() {
  const { lockedPlatform, allowsPlatform } = usePermissions()

  const platform: Platform = lockedPlatform ?? (allowsPlatform('android') ? 'android' : 'windows')

  return useDevicesQuery({
    platform,
    pageNum: 1,
    pageSize: 100,
    sortBy: 'LAST_UPDATE',
    sortDir: 'ASC',
  })
}

export function useDashboardPlatform(): Platform {
  const { lockedPlatform, allowsPlatform } = usePermissions()
  return lockedPlatform ?? (allowsPlatform('android') ? 'android' : 'windows')
}
