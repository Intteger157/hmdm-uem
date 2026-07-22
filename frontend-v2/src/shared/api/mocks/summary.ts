import type { SummaryResponse } from '@/shared/api/types/summary'
import { mockNetworkDelay } from '@/shared/api/mock-utils'

export const MOCK_SUMMARY: SummaryResponse = {
  devicesTotal: 142,
  devicesEnrolled: 138,
  devicesEnrolledLastMonth: 12,
  topConfigs: ['Warehouse Kiosk', 'Field Sales', 'Corporate Standard', 'Windows Office', 'Demo Lab'],
  statusSummary: [
    { stringAttr: 'Online', intAttr: 0, number: 98 },
    { stringAttr: 'Idle', intAttr: 0, number: 24 },
    { stringAttr: 'Offline', intAttr: 0, number: 16 },
    { stringAttr: 'Unknown', intAttr: 0, number: 4 },
  ],
  installSummary: [
    { stringAttr: 'Success', intAttr: 0, number: 120 },
    { stringAttr: 'Version mismatch', intAttr: 0, number: 11 },
    { stringAttr: 'Failure', intAttr: 0, number: 7 },
  ],
  statusOnlineByConfig: [42, 28, 18, 8, 2],
  statusIdleByConfig: [8, 6, 5, 3, 2],
  statusOfflineByConfig: [3, 4, 5, 2, 2],
  appSuccessByConfig: [40, 30, 22, 18, 10],
  appMismatchByConfig: [2, 3, 2, 2, 2],
  appFailureByConfig: [1, 2, 1, 1, 2],
  devicesEnrolledMonthly: [
    { stringAttr: 'Sep', intAttr: 0, number: 8 },
    { stringAttr: 'Oct', intAttr: 0, number: 11 },
    { stringAttr: 'Nov', intAttr: 0, number: 9 },
    { stringAttr: 'Dec', intAttr: 0, number: 14 },
    { stringAttr: 'Jan', intAttr: 0, number: 10 },
    { stringAttr: 'Feb', intAttr: 0, number: 12 },
  ],
}

export async function mockFetchDeviceSummary(): Promise<SummaryResponse> {
  await mockNetworkDelay()
  return MOCK_SUMMARY
}
