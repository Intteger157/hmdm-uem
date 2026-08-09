import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { DashboardMetrics } from '@/features/dashboard/lib/dashboard-metrics'
import { dashboardEnterClass, dashboardSectionClass } from '@/features/dashboard/lib/dashboard-styles'
import { Progress, ProgressIndicator, ProgressTrack } from '@/components/ui/progress'
import type { Platform } from '@/shared/api/types/platform'
import { cn } from '@/lib/utils'

interface DashboardApplicationHealthProps {
  metrics: DashboardMetrics
  platform: Platform
}

const ROWS = [
  { key: 'success' as const, countKey: 'installSuccess' as const, tone: 'bg-emerald-500/85' },
  { key: 'mismatch' as const, countKey: 'installMismatch' as const, tone: 'bg-amber-500/85' },
  { key: 'failure' as const, countKey: 'installFailure' as const, tone: 'bg-rose-500/85' },
]

export function DashboardApplicationHealth({ metrics, platform }: DashboardApplicationHealthProps) {
  const { t } = useTranslation()
  const maxCount = Math.max(metrics.installTotal, 1)

  const applicationsPath = platform === 'windows' ? '/windows/applications' : '/applications'

  return (
    <section className={cn(dashboardSectionClass(), dashboardEnterClass(4))}>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{t('dashboard.applicationHealth.title')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('dashboard.applicationHealth.description')}
          </p>
        </div>
        <Link
          to={applicationsPath}
          className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          {t('dashboard.applicationHealth.viewApplications')}
          <ArrowRight className="size-3.5" />
        </Link>
      </div>

      {metrics.installTotal <= 0 ? (
        <p className="text-sm text-muted-foreground">{t('dashboard.installEmpty')}</p>
      ) : (
        <div className="space-y-4">
          {ROWS.map((row) => {
            const count = metrics[row.countKey]
            const width = Math.max(count > 0 ? 6 : 0, (count / maxCount) * 100)
            return (
              <div key={row.key} className="space-y-2">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">
                    {t(`dashboard.applicationHealth.${row.key}`)}
                  </span>
                  <span className="font-semibold tabular-nums text-foreground">{count}</span>
                </div>
                <Progress value={width} className="gap-0">
                  <ProgressTrack className="h-2 bg-muted/40 dark:bg-white/5">
                    <ProgressIndicator className={cn('transition-all duration-500', row.tone)} />
                  </ProgressTrack>
                </Progress>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
