import { useQuery } from '@tanstack/react-query'
import { fetchDeviceSummary } from '@/features/dashboard/api/summary-api'

export const summaryQueryKeys = {
  devices: ['summary', 'devices'] as const,
}

export function useDeviceSummaryQuery() {
  return useQuery({
    queryKey: summaryQueryKeys.devices,
    queryFn: fetchDeviceSummary,
  })
}
