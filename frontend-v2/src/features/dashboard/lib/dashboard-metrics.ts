import type { ChartItem, SummaryResponse } from '@/shared/api/types/summary'

export interface FleetHealthBucket {
  key: 'healthy' | 'atRisk' | 'offline' | 'notEnrolled'
  count: number
  percent: number
}

export interface DashboardMetrics {
  total: number
  enrolled: number
  notEnrolled: number
  enrolledPercent: number
  enrolledLastMonth: number
  online: number
  idle: number
  offline: number
  unknown: number
  installSuccess: number
  installMismatch: number
  installFailure: number
  installTotal: number
  attentionCount: number
  fleetHealth: FleetHealthBucket[]
  hasCriticalAlerts: boolean
}

function normalizeInstallKey(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, '_')
}

function installCount(items: ChartItem[], predicate: (key: string) => boolean): number {
  return items
    .filter((item) => predicate(normalizeInstallKey(item.stringAttr)))
    .reduce((sum, item) => sum + item.number, 0)
}

function statusCount(items: ChartItem[], codes: string[]): number {
  return items
    .filter((item) => codes.includes(item.stringAttr))
    .reduce((sum, item) => sum + item.number, 0)
}

function percent(value: number, total: number): number {
  if (total <= 0) {
    return 0
  }
  return Math.round((value / total) * 100)
}

export function deriveDashboardMetrics(data: SummaryResponse): DashboardMetrics {
  const total = data.devicesTotal
  const enrolled = data.devicesEnrolled
  const notEnrolled = Math.max(total - enrolled, 0)

  const online = statusCount(data.statusSummary, ['green'])
  const idle = statusCount(data.statusSummary, ['yellow'])
  const offline = statusCount(data.statusSummary, ['red'])
  const unknown = statusCount(data.statusSummary, ['grey', 'brown'])

  const installSuccess = installCount(data.installSummary, (key) => key.includes('SUCCESS'))
  const installMismatch = installCount(
    data.installSummary,
    (key) => key.includes('MISMATCH') || key.includes('VERSION'),
  )
  const installFailure = installCount(data.installSummary, (key) => key.includes('FAIL'))
  const installTotal = installSuccess + installMismatch + installFailure

  const attentionCount = installMismatch + installFailure

  const fleetHealth: FleetHealthBucket[] = [
    { key: 'healthy', count: online, percent: percent(online, total) },
    { key: 'atRisk', count: idle + attentionCount, percent: percent(idle + attentionCount, total) },
    { key: 'offline', count: offline + unknown, percent: percent(offline + unknown, total) },
    { key: 'notEnrolled', count: notEnrolled, percent: percent(notEnrolled, total) },
  ]

  const hasCriticalAlerts = attentionCount > 0 || offline > 0 || notEnrolled > 0

  return {
    total,
    enrolled,
    notEnrolled,
    enrolledPercent: percent(enrolled, total),
    enrolledLastMonth: data.devicesEnrolledLastMonth,
    online,
    idle,
    offline: offline + unknown,
    unknown,
    installSuccess,
    installMismatch,
    installFailure,
    installTotal,
    attentionCount,
    fleetHealth,
    hasCriticalAlerts,
  }
}

export function sliceEnrollmentTrend(
  items: ChartItem[],
  rangeDays: 7 | 30 | 90,
): ChartItem[] {
  if (items.length === 0) {
    return []
  }

  if (rangeDays === 7) {
    return []
  }

  const months = rangeDays === 30 ? 1 : 3
  return items.slice(-months)
}
