import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  deviceDisplayName,
  type AttentionDeviceRow,
} from '@/features/dashboard/lib/dashboard-attention'
import { formatRelativeTimeI18n } from '@/features/dashboard/lib/format-relative-time'
import { dashboardEnterClass, dashboardSectionClass } from '@/features/dashboard/lib/dashboard-styles'
import type { Platform } from '@/shared/api/types/platform'
import { cn } from '@/lib/utils'

interface DashboardAttentionDevicesProps {
  devices: AttentionDeviceRow[]
  platform: Platform
  appIssueCount: number
  isLoading: boolean
}

const STATUS_BADGE: Record<AttentionDeviceRow['severity'], string> = {
  critical: 'text-rose-400 bg-rose-500/10 ring-rose-500/20',
  warning: 'text-amber-400 bg-amber-500/10 ring-amber-500/20',
  info: 'text-slate-400 bg-slate-500/10 ring-slate-500/20',
}

export function DashboardAttentionDevices({
  devices,
  platform,
  appIssueCount,
  isLoading,
}: DashboardAttentionDevicesProps) {
  const { t } = useTranslation()

  return (
    <section className={cn(dashboardSectionClass('p-0'), dashboardEnterClass(5))}>
      <div className="border-b border-border/80 px-6 py-5 dark:border-[#242424]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              {t('dashboard.attention.title')}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{t('dashboard.attention.description')}</p>
          </div>
          <Link
            to="/devices"
            search={{ platform }}
            className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {t('dashboard.attention.viewAll')}
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="px-6 py-8 text-sm text-muted-foreground">{t('dashboard.loading')}</div>
      ) : devices.length === 0 ? (
        <div className="px-6 py-8">
          <p className="text-sm font-medium text-foreground">{t('dashboard.attention.emptyTitle')}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {appIssueCount > 0
              ? t('dashboard.attention.emptyWithAppIssues', { count: appIssueCount })
              : t('dashboard.attention.emptyDescription')}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="border-b border-border/80 text-xs uppercase tracking-wide text-muted-foreground dark:border-[#242424]">
              <tr>
                <th className="px-6 py-3 font-medium">{t('dashboard.attention.columnDevice')}</th>
                <th className="px-4 py-3 font-medium">{t('dashboard.attention.columnStatus')}</th>
                <th className="px-6 py-3 font-medium">{t('dashboard.attention.columnIssue')}</th>
              </tr>
            </thead>
            <tbody>
              {devices.map(({ device, severity, issueKey, lastSeenMs, status }) => (
                <tr
                  key={device.number}
                  className="border-b border-border/50 transition-colors last:border-0 hover:bg-muted/20 dark:border-[#242424]"
                >
                  <td className="px-6 py-3.5">
                    <Link
                      to="/devices/$deviceNumber"
                      params={{ deviceNumber: device.number }}
                      search={{ platform: device.platform }}
                      className="font-medium text-foreground hover:underline"
                    >
                      {deviceDisplayName(device)}
                    </Link>
                    <p className="mt-0.5 font-mono text-xs text-muted-foreground">{device.number}</p>
                  </td>
                  <td className="px-4 py-3.5">
                    <span
                      className={cn(
                        'inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
                        STATUS_BADGE[severity],
                      )}
                    >
                      {t(`devices.status.${status}`)}
                    </span>
                  </td>
                  <td className="px-6 py-3.5 text-muted-foreground">
                    {t(issueKey)}
                    {lastSeenMs ? (
                      <span className="mt-0.5 block text-xs">
                        {t('dashboard.attention.lastSeen', {
                          time: formatRelativeTimeI18n(lastSeenMs, t),
                        })}
                      </span>
                    ) : null}
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
