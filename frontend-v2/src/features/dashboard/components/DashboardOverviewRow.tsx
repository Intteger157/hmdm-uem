import { Link } from '@tanstack/react-router'
import { Activity, AlertTriangle, CheckCircle2, Smartphone } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { DashboardMetrics } from '@/features/dashboard/lib/dashboard-metrics'
import {
  dashboardAttentionCardClass,
  dashboardEnterClass,
  dashboardMetricCardClass,
} from '@/features/dashboard/lib/dashboard-styles'
import { Progress, ProgressIndicator, ProgressTrack } from '@/components/ui/progress'
import type { Platform } from '@/shared/api/types/platform'
import { cn } from '@/lib/utils'

interface DashboardOverviewRowProps {
  metrics: DashboardMetrics
  platform: Platform
}

export function DashboardOverviewRow({ metrics, platform }: DashboardOverviewRowProps) {
  const { t } = useTranslation()

  return (
    <div className={cn('grid gap-4 sm:grid-cols-2 xl:grid-cols-4', dashboardEnterClass(2))}>
      <article className={dashboardMetricCardClass()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t('dashboard.overview.fleet')}
            </p>
            <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight">{metrics.total}</p>
          </div>
          <Smartphone className="size-4 shrink-0 text-muted-foreground/70" />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          {t('dashboard.overview.fleetDetail', {
            enrolled: metrics.enrolled,
            notEnrolled: metrics.notEnrolled,
          })}
        </p>
      </article>

      <article className={dashboardMetricCardClass()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t('dashboard.overview.online')}
            </p>
            <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight">{metrics.online}</p>
          </div>
          <Activity className="size-4 shrink-0 text-muted-foreground/70" />
        </div>
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-emerald-500/80" />
            {t('dashboard.overview.onlineBreakdown', { count: metrics.online })}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-amber-500/80" />
            {t('dashboard.overview.idleBreakdown', { count: metrics.idle })}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-slate-500/80" />
            {t('dashboard.overview.offlineBreakdown', { count: metrics.offline })}
          </span>
        </div>
      </article>

      <article className={dashboardMetricCardClass()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t('dashboard.overview.enrollment')}
            </p>
            <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight">
              {metrics.enrolled}
              <span className="ml-1 text-lg font-medium text-muted-foreground">/ {metrics.total}</span>
            </p>
          </div>
          <CheckCircle2 className="size-4 shrink-0 text-muted-foreground/70" />
        </div>
        <div className="mt-3 space-y-2">
          <Progress value={metrics.enrolledPercent} className="gap-0">
            <ProgressTrack className="h-1.5 bg-muted/50 dark:bg-white/5">
              <ProgressIndicator className="bg-violet-500/90" />
            </ProgressTrack>
          </Progress>
          <p className="text-xs text-muted-foreground">
            {t('dashboard.overview.enrolledPercent', { percent: metrics.enrolledPercent })}
          </p>
        </div>
      </article>

      <Link
        to="/devices"
        search={{ platform }}
        className={cn(
          dashboardAttentionCardClass('block transition-opacity hover:opacity-95'),
          metrics.attentionCount <= 0 && 'border-border/80 dark:border-[#242424]',
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t('dashboard.overview.attention')}
            </p>
            <p
              className={cn(
                'mt-2 text-3xl font-bold tabular-nums tracking-tight',
                metrics.attentionCount > 0 ? 'text-amber-400' : 'text-foreground',
              )}
            >
              {metrics.attentionCount}
            </p>
          </div>
          <AlertTriangle
            className={cn(
              'size-4 shrink-0',
              metrics.attentionCount > 0 ? 'text-amber-500' : 'text-muted-foreground/70',
            )}
          />
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          {metrics.attentionCount > 0
            ? t('dashboard.overview.attentionDetail', { count: metrics.attentionCount })
            : t('dashboard.overview.attentionClear')}
        </p>
      </Link>
    </div>
  )
}
