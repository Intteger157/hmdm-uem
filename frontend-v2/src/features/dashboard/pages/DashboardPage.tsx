import { useEffect, useMemo, useRef } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
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
import { deriveDashboardMetrics } from '@/features/dashboard/lib/dashboard-metrics'
import {
  useDashboardAttentionDevicesQuery,
  useDeviceSummaryQuery,
} from '@/features/dashboard/hooks/use-device-summary-query'
import { usePermissions } from '@/features/auth/hooks/use-permissions'
import { Button } from '@/components/ui/button'
import { PageContainer } from '@/shared/layout/page-layout'
import { usePeriodicNow } from '@/shared/hooks/use-periodic-now'
import type { Platform } from '@/shared/api/types/platform'

interface DashboardPageProps {
  platform: Platform
}

export function DashboardPage({ platform: requestedPlatform }: DashboardPageProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { lockedPlatform } = usePermissions()
  const platform = lockedPlatform ?? requestedPlatform
  usePeriodicNow()
  const summaryQuery = useDeviceSummaryQuery(platform)
  const attentionQuery = useDashboardAttentionDevicesQuery(platform, 5)

  useEffect(() => {
    if (lockedPlatform && requestedPlatform !== lockedPlatform) {
      void navigate({ to: '/dashboard', search: { platform: lockedPlatform }, replace: true })
    }
  }, [lockedPlatform, requestedPlatform, navigate])

  const summary = summaryQuery.data?.summary
  const metrics = useMemo(
    () => (summary ? deriveDashboardMetrics(summary) : null),
    [summary],
  )

  const partialWarnings = useMemo(() => {
    const combined = [
      ...(summaryQuery.data?.warnings ?? []),
      ...(attentionQuery.data?.warnings ?? []),
    ]
    return [...new Set(combined)]
  }, [summaryQuery.data?.warnings, attentionQuery.data?.warnings])

  const warnedRef = useRef('')
  useEffect(() => {
    if (partialWarnings.length === 0) {
      warnedRef.current = ''
      return
    }

    const key = partialWarnings.join('|')
    if (warnedRef.current === key) {
      return
    }
    warnedRef.current = key
    toast.warning(t('dashboard.partialData.title'), {
      id: 'dashboard-partial-data',
      description: partialWarnings.join(' '),
    })
  }, [partialWarnings, t])

  if (summaryQuery.isLoading) {
    return <DashboardSkeleton />
  }

  if (summaryQuery.error || !summary || !metrics) {
    return (
      <PageContainer size="full">
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
      </PageContainer>
    )
  }

  return (
    <PageContainer size="full" className="pb-8">
      <DashboardHeader
        platform={platform}
        dataUpdatedAt={summaryQuery.dataUpdatedAt}
        isFetching={summaryQuery.isFetching}
        onRefresh={() => void summaryQuery.refetch()}
      />

      <DashboardQuickActionsInline platform={platform} />

      <DashboardAlerts metrics={metrics} platform={platform} />

      <DashboardOverviewRow metrics={metrics} platform={platform} />

      <div className="grid gap-6 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <DashboardFleetHealth buckets={metrics.fleetHealth} total={metrics.total} />
        </div>
        <div className="xl:col-span-2">
          <DashboardQuickActions platform={platform} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <DashboardEnrollmentTrend monthly={summary.devicesEnrolledMonthly} />
        <DashboardApplicationHealth metrics={metrics} platform={platform} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <DashboardAttentionDevices
          devices={attentionQuery.data?.devices ?? []}
          platform={platform}
          appIssueCount={metrics.installMismatch + metrics.installFailure}
          isLoading={attentionQuery.isLoading}
        />
        <DashboardRecentActivity />
      </div>

      {metrics.total === 0 ? (
        <div className="rounded-xl border border-dashed border-border/70 px-6 py-8 text-center dark:border-[#242424]">
          <p className="text-sm font-medium text-foreground">{t('dashboard.empty.noDevicesTitle')}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t('dashboard.empty.noDevicesDescription')}</p>
        </div>
      ) : null}
    </PageContainer>
  )
}

function DashboardSkeleton() {
  const { t } = useTranslation()

  return (
    <PageContainer size="full" className="pb-8">
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
      <div className="grid gap-6 xl:grid-cols-5">
        <div className="h-72 animate-pulse rounded-xl border border-border/80 bg-card dark:border-[#242424] dark:bg-[#111111] xl:col-span-3" />
        <div className="h-72 animate-pulse rounded-xl border border-border/80 bg-card dark:border-[#242424] dark:bg-[#111111] xl:col-span-2" />
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
    </PageContainer>
  )
}
