import { useQuery } from '@tanstack/react-query'
import { fetchDeviceSummary } from '@/features/dashboard/api/summary-api'

export const summaryQueryKeys = {
  devices: ['summary', 'devices'] as const,
}

const SUMMARY_POLL_INTERVAL_MS = 60_000

export function useDeviceSummaryQuery() {
  return useQuery({
    queryKey: summaryQueryKeys.devices,
    queryFn: fetchDeviceSummary,
    refetchInterval: SUMMARY_POLL_INTERVAL_MS,
  })
}
