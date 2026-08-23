import { useQuery } from '@tanstack/react-query'
import {
  fetchDashboardAttentionDevices,
  fetchDeviceSummary,
} from '@/features/dashboard/api/summary-api'
import { rankAttentionDevices } from '@/features/dashboard/lib/dashboard-attention'
import { searchDevices } from '@/features/devices/api/devices-api'
import { searchWindowsDevices } from '@/features/windows/api/windows-api'
import type { Platform } from '@/shared/api/types/platform'

export const summaryQueryKeys = {
  devices: ['summary', 'devices'] as const,
  attention: ['dashboard', 'attention-devices'] as const,
}

const SUMMARY_POLL_INTERVAL_MS = 60_000

export function useDeviceSummaryQuery(platform: Platform) {
  return useQuery({
    queryKey: [...summaryQueryKeys.devices, platform],
    queryFn: () => fetchDeviceSummary(platform),
    refetchInterval: SUMMARY_POLL_INTERVAL_MS,
  })
}

async function fetchAttentionDevicesClient(limit: number, platform: Platform) {
  const combined =
    platform === 'android'
      ? (
          await searchDevices({
            platform: 'android',
            pageNum: 1,
            pageSize: 100,
            sortBy: 'LAST_UPDATE',
            sortDir: 'ASC',
          })
        ).devices.items
      : (
          await searchWindowsDevices({
            platform: 'windows',
            pageNum: 1,
            pageSize: 100,
            sortBy: 'LAST_UPDATE',
            sortDir: 'ASC',
          })
        ).devices.items

  return rankAttentionDevices(combined, Date.now(), limit)
}

export function useDashboardAttentionDevicesQuery(platform: Platform, limit = 5) {
  return useQuery({
    queryKey: [...summaryQueryKeys.attention, platform, limit],
    queryFn: async () => {
      const unified = await fetchDashboardAttentionDevices(limit, platform)
      if (unified.devices.length > 0) {
        return unified
      }

      const fallbackDevices = await fetchAttentionDevicesClient(limit, platform)
      return {
        devices: fallbackDevices,
        warnings: unified.warnings,
      }
    },
    refetchInterval: SUMMARY_POLL_INTERVAL_MS,
  })
}
