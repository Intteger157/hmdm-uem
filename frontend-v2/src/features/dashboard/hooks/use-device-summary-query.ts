import { useQuery } from '@tanstack/react-query'
import {
  fetchDashboardAttentionDevices,
  fetchDeviceSummary,
} from '@/features/dashboard/api/summary-api'
import { rankAttentionDevices } from '@/features/dashboard/lib/dashboard-attention'
import { searchDevices } from '@/features/devices/api/devices-api'
import { searchWindowsDevices } from '@/features/windows/api/windows-api'
import { usePermissions } from '@/features/auth/hooks/use-permissions'
import type { DeviceView } from '@/shared/api/types/device'

export const summaryQueryKeys = {
  devices: ['summary', 'devices'] as const,
  attention: ['dashboard', 'attention-devices'] as const,
}

const SUMMARY_POLL_INTERVAL_MS = 60_000

export function useDeviceSummaryQuery() {
  return useQuery({
    queryKey: summaryQueryKeys.devices,
    queryFn: fetchDeviceSummary,
    refetchInterval: SUMMARY_POLL_INTERVAL_MS,
  })
}

async function fetchAttentionDevicesClient(
  limit: number,
  lockedPlatform: 'android' | 'windows' | null,
  allowsPlatform: (platform: 'android' | 'windows') => boolean,
) {
  const includeAndroid = lockedPlatform ? lockedPlatform === 'android' : allowsPlatform('android')
  const includeWindows = lockedPlatform ? lockedPlatform === 'windows' : allowsPlatform('windows')

  const combined: DeviceView[] = []
  const tasks: Promise<void>[] = []

  if (includeAndroid) {
    tasks.push(
      searchDevices({ platform: 'android', pageNum: 1, pageSize: 100, sortBy: 'LAST_UPDATE', sortDir: 'ASC' }).then(
        (result) => {
          combined.push(...result.devices.items)
        },
      ),
    )
  }
  if (includeWindows) {
    tasks.push(
      searchWindowsDevices({ platform: 'windows', pageNum: 1, pageSize: 100, sortBy: 'LAST_UPDATE', sortDir: 'ASC' }).then(
        (result) => {
          combined.push(...result.devices.items)
        },
      ),
    )
  }

  await Promise.allSettled(tasks)
  return rankAttentionDevices(combined, Date.now(), limit)
}

export function useDashboardAttentionDevicesQuery(limit = 5) {
  const { lockedPlatform, allowsPlatform } = usePermissions()

  return useQuery({
    queryKey: [...summaryQueryKeys.attention, limit, lockedPlatform ?? 'all'],
    queryFn: async () => {
      const unified = await fetchDashboardAttentionDevices(limit)
      if (unified.devices.length > 0) {
        return unified
      }

      const fallbackDevices = await fetchAttentionDevicesClient(limit, lockedPlatform, allowsPlatform)
      return {
        devices: fallbackDevices,
        warnings: unified.warnings,
      }
    },
    refetchInterval: SUMMARY_POLL_INTERVAL_MS,
  })
}

export function useDashboardPlatform(): 'android' | 'windows' {
  const { lockedPlatform, allowsPlatform } = usePermissions()
  return lockedPlatform ?? (allowsPlatform('android') ? 'android' : 'windows')
}
