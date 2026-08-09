import { Link } from '@tanstack/react-router'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { DashboardMetrics } from '@/features/dashboard/lib/dashboard-metrics'
import { dashboardEnterClass, dashboardSectionClass } from '@/features/dashboard/lib/dashboard-styles'
import { Button } from '@/components/ui/button'
import type { Platform } from '@/shared/api/types/platform'
import { cn } from '@/lib/utils'

interface DashboardAlertsProps {
  metrics: DashboardMetrics
  platform: Platform
}

export function DashboardAlerts({ metrics, platform }: DashboardAlertsProps) {
  const { t } = useTranslation()

  if (!metrics.hasCriticalAlerts) {
    return (
      <div
        className={cn(
          dashboardSectionClass('flex items-center gap-3 border-emerald-500/20 py-4 dark:border-emerald-500/25'),
          dashboardEnterClass(1),
        )}
      >
        <CheckCircle2 className="size-5 shrink-0 text-emerald-500/90" />
        <div>
          <p className="text-sm font-medium text-foreground">{t('dashboard.alerts.allClearTitle')}</p>
          <p className="text-sm text-muted-foreground">{t('dashboard.alerts.allClearDescription')}</p>
        </div>
      </div>
    )
  }

  const items: string[] = []
  if (metrics.installMismatch > 0) {
    items.push(t('dashboard.alerts.versionMismatch', { count: metrics.installMismatch }))
  }
  if (metrics.installFailure > 0) {
    items.push(t('dashboard.alerts.installFailure', { count: metrics.installFailure }))
  }
  if (metrics.offline > 0) {
    items.push(t('dashboard.alerts.offline', { count: metrics.offline }))
  }
  if (metrics.notEnrolled > 0) {
    items.push(t('dashboard.alerts.notEnrolled', { count: metrics.notEnrolled }))
  }

  return (
    <div
      className={cn(
        dashboardSectionClass('border-amber-500/25 py-4 dark:border-amber-500/30'),
        dashboardEnterClass(1),
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-500" />
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-500/90">
              {t('dashboard.alerts.attention')}
            </p>
            <ul className="space-y-1 text-sm text-foreground">
              {items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0"
          render={<Link to="/devices" search={{ platform }} />}
        >
          {t('dashboard.alerts.viewDevices')}
        </Button>
      </div>
    </div>
  )
}
