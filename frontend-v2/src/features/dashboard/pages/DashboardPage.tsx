import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { DashboardAlerts } from '@/features/dashboard/components/DashboardAlerts'
import { DashboardApplicationHealth } from '@/features/dashboard/components/DashboardApplicationHealth'
import { DashboardAttentionDevices } from '@/features/dashboard/components/DashboardAttentionDevices'
import { DashboardEnrollmentTrend } from '@/features/dashboard/components/DashboardEnrollmentTrend'
import { DashboardFleetHealth } from '@/features/dashboard/components/DashboardFleetHealth'
import { DashboardHeader } from '@/features/dashboard/components/DashboardHeader'
import { DashboardOverviewRow } from '@/features/dashboard/components/DashboardOverviewRow'
import {
  DashboardQuickActions,
  DashboardQuickActionsInline,
} from '@/features/dashboard/components/DashboardQuickActions'
import { DashboardRecentActivity } from '@/features/dashboard/components/DashboardRecentActivity'
import { rankAttentionDevices } from '@/features/dashboard/lib/dashboard-attention'
import { deriveDashboardMetrics } from '@/features/dashboard/lib/dashboard-metrics'
import { DASHBOARD_CONTAINER_CLASS } from '@/features/dashboard/lib/dashboard-styles'
import {
  useDashboardFleetDevices,
  useDashboardPlatform,
} from '@/features/dashboard/hooks/use-dashboard-fleet-devices'
import { useDeviceSummaryQuery } from '@/features/dashboard/hooks/use-device-summary-query'
import { Button } from '@/components/ui/button'
import { usePeriodicNow } from '@/shared/hooks/use-periodic-now'
import { cn } from '@/lib/utils'

export function DashboardPage() {
  const { t } = useTranslation()
  const now = usePeriodicNow()
  const platform = useDashboardPlatform()
  const summaryQuery = useDeviceSummaryQuery()
  const fleetQuery = useDashboardFleetDevices()

  const metrics = useMemo(
    () => (summaryQuery.data ? deriveDashboardMetrics(summaryQuery.data) : null),
    [summaryQuery.data],
  )

  const attentionDevices = useMemo(() => {
    const items = fleetQuery.data?.devices.items ?? []
    return rankAttentionDevices(items, now, 5)
  }, [fleetQuery.data?.devices.items, now])

  if (summaryQuery.isLoading) {
    return <DashboardSkeleton />
  }

  if (summaryQuery.error || !summaryQuery.data || !metrics) {
    return (
      <div className={DASHBOARD_CONTAINER_CLASS}>
        <div className="rounded-xl border border-destructive/40 bg-card p-6 dark:bg-[#111111]">
          <h2 className="text-lg font-semibold text-destructive">{t('dashboard.errorTitle')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('dashboard.errorDescription')}</p>
          <Button
            type="button"
            variant="outline"
            className="mt-4"
            onClick={() => void summaryQuery.refetch()}
          >
            {t('dashboard.retry')}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className={cn(DASHBOARD_CONTAINER_CLASS, 'space-y-6 pb-8')}>
      <DashboardHeader
        dataUpdatedAt={summaryQuery.dataUpdatedAt}
        isFetching={summaryQuery.isFetching}
        onRefresh={() => void summaryQuery.refetch()}
      />

      <DashboardQuickActionsInline />

      <DashboardAlerts metrics={metrics} platform={platform} />

      <DashboardOverviewRow metrics={metrics} platform={platform} />

      <div className="grid gap-6 xl:grid-cols-[1fr_280px]">
        <DashboardFleetHealth buckets={metrics.fleetHealth} total={metrics.total} />
        <DashboardQuickActions />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <DashboardEnrollmentTrend monthly={summaryQuery.data.devicesEnrolledMonthly} />
        <DashboardApplicationHealth metrics={metrics} platform={platform} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <DashboardAttentionDevices
          devices={attentionDevices}
          platform={platform}
          appIssueCount={metrics.installMismatch + metrics.installFailure}
          isLoading={fleetQuery.isLoading}
        />
        <DashboardRecentActivity />
      </div>

      {metrics.total === 0 ? (
        <div className="rounded-xl border border-dashed border-border/70 px-6 py-8 text-center dark:border-[#242424]">
          <p className="text-sm font-medium text-foreground">{t('dashboard.empty.noDevicesTitle')}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t('dashboard.empty.noDevicesDescription')}</p>
        </div>
      ) : null}
    </div>
  )
}

function DashboardSkeleton() {
  const { t } = useTranslation()

  return (
    <div className={cn(DASHBOARD_CONTAINER_CLASS, 'space-y-6 pb-8')}>
      <div className="space-y-2">
        <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-72 animate-pulse rounded-md bg-muted/70" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-32 animate-pulse rounded-xl border border-border/80 bg-card dark:border-[#242424] dark:bg-[#111111]"
          />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_280px]">
        <div className="h-72 animate-pulse rounded-xl border border-border/80 bg-card dark:border-[#242424] dark:bg-[#111111]" />
        <div className="h-72 animate-pulse rounded-xl border border-border/80 bg-card dark:border-[#242424] dark:bg-[#111111]" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <div
            key={index}
            className="h-64 animate-pulse rounded-xl border border-border/80 bg-card dark:border-[#242424] dark:bg-[#111111]"
          />
        ))}
      </div>
      <p className="sr-only">{t('dashboard.loading')}</p>
    </div>
  )
}
