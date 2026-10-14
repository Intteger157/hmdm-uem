import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { AppVersionMismatchRow } from '@/features/dashboard/api/summary-api'
import { dashboardEnterClass, dashboardSectionClass } from '@/features/dashboard/lib/dashboard-styles'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface DashboardAppVersionMismatchesProps {
  items: AppVersionMismatchRow[]
  devicesAffected: number
  isLoading: boolean
}

function directionBadgeClass(direction: AppVersionMismatchRow['direction']): string {
  if (direction === 'lower') {
    return 'bg-amber-500/15 text-amber-400 ring-amber-500/25'
  }
  return 'bg-sky-500/15 text-sky-400 ring-sky-500/25'
}

export function DashboardAppVersionMismatches({
  items,
  devicesAffected,
  isLoading,
}: DashboardAppVersionMismatchesProps) {
  const { t } = useTranslation()

  return (
    <section className={cn(dashboardSectionClass('p-0'), dashboardEnterClass(6))}>
      <div className="border-b border-border/80 px-6 py-5 dark:border-[#242424]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              {t('dashboard.appVersionDrift.title')}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('dashboard.appVersionDrift.description')}
            </p>
            {devicesAffected > 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">
                {t('dashboard.appVersionDrift.devicesAffected', { count: devicesAffected })}
              </p>
            ) : null}
          </div>
          <Link
            to="/windows/applications"
            className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {t('dashboard.appVersionDrift.viewApplications')}
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="px-6 py-8 text-sm text-muted-foreground">{t('dashboard.loading')}</div>
      ) : items.length === 0 ? (
        <div className="px-6 py-8">
          <p className="text-sm font-medium text-foreground">{t('dashboard.appVersionDrift.emptyTitle')}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t('dashboard.appVersionDrift.emptyDescription')}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-border/80 text-xs uppercase tracking-wide text-muted-foreground dark:border-[#242424]">
                <th className="px-6 py-3 font-medium">{t('dashboard.appVersionDrift.columnDevice')}</th>
                <th className="px-4 py-3 font-medium">{t('dashboard.appVersionDrift.columnApp')}</th>
                <th className="px-4 py-3 font-medium">{t('dashboard.appVersionDrift.columnExpected')}</th>
                <th className="px-4 py-3 font-medium">{t('dashboard.appVersionDrift.columnInstalled')}</th>
                <th className="px-4 py-3 font-medium">{t('dashboard.appVersionDrift.columnDrift')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr
                  key={`${row.deviceHardwareId}-${row.appId}-${row.expectedVersion}`}
                  className="border-b border-border/50 last:border-0 dark:border-[#242424]/80"
                >
                  <td className="px-6 py-3">
                    <Link
                      to="/devices/$deviceNumber"
                      params={{ deviceNumber: row.deviceHardwareId }}
                      search={{ platform: 'windows' }}
                      className="font-medium text-foreground hover:underline"
                    >
                      {row.deviceDisplayName}
                    </Link>
                    {row.profileName ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">{row.profileName}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-foreground">{row.appName}</td>
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">{row.expectedVersion}</td>
                  <td className="px-4 py-3 tabular-nums text-foreground">
                    {row.installedVersion || t('dashboard.appVersionDrift.notInstalled')}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={cn('ring-1 ring-inset', directionBadgeClass(row.direction))}>
                      {row.direction === 'lower'
                        ? t('dashboard.appVersionDrift.driftLower')
                        : t('dashboard.appVersionDrift.driftHigher')}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
