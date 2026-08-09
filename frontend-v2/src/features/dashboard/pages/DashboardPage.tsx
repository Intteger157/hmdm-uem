import {
  Activity,
  CheckCircle2,
  Smartphone,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { useDeviceSummaryQuery } from '@/features/dashboard/hooks/use-device-summary-query'
import { APP_PAGE_CONTAINER_CLASS } from '@/features/devices/components/overview-card-styles'
import { Button } from '@/components/ui/button'
import { Progress, ProgressIndicator, ProgressTrack } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import type { ChartItem } from '@/shared/api/types/summary'

const BENTO_PANEL_CLASS =
  'rounded-2xl border border-border/80 bg-card p-6 shadow-none dark:border-white/10 dark:bg-[#111]'

const STATUS_VISUALS: Record<
  string,
  { barClass: string; dotClass: string; order: number }
> = {
  green: { barClass: 'bg-emerald-500', dotClass: 'bg-emerald-500', order: 0 },
  yellow: { barClass: 'bg-amber-500', dotClass: 'bg-amber-500', order: 1 },
  red: { barClass: 'bg-rose-500', dotClass: 'bg-rose-500', order: 2 },
  grey: { barClass: 'bg-slate-600', dotClass: 'bg-slate-600', order: 3 },
  brown: { barClass: 'bg-slate-600', dotClass: 'bg-slate-600', order: 4 },
}

type InstallTone = 'success' | 'warning' | 'danger' | 'neutral'

const INSTALL_VISUALS: Record<InstallTone, { barClass: string; badgeClass: string }> = {
  success: {
    barClass: 'bg-emerald-500',
    badgeClass: 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/30',
  },
  warning: {
    barClass: 'bg-amber-500',
    badgeClass: 'bg-amber-500/15 text-amber-400 ring-amber-500/30',
  },
  danger: {
    barClass: 'bg-rose-500',
    badgeClass: 'bg-rose-500/15 text-rose-400 ring-rose-500/30',
  },
  neutral: {
    barClass: 'bg-slate-500',
    badgeClass: 'bg-slate-500/15 text-slate-400 ring-slate-500/30',
  },
}

function statusLabel(t: TFunction, code: string): string {
  const key = `devices.status.${code}`
  const translated = t(key)
  return translated === key ? code : translated
}

function normalizeInstallKey(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, '_')
}

function resolveInstallTone(key: string): InstallTone {
  if (key.includes('SUCCESS')) {
    return 'success'
  }
  if (key.includes('MISMATCH') || key.includes('VERSION')) {
    return 'warning'
  }
  if (key.includes('FAIL')) {
    return 'danger'
  }
  return 'neutral'
}

function installLabel(t: TFunction, raw: string): string {
  const key = normalizeInstallKey(raw)
  if (key.includes('SUCCESS')) {
    return t('dashboard.install.success')
  }
  if (key.includes('MISMATCH') || key.includes('VERSION')) {
    return t('dashboard.install.versionMismatch')
  }
  if (key.includes('FAIL')) {
    return t('dashboard.install.failure')
  }
  return raw
}

function formatPercent(value: number, total: number): number {
  if (total <= 0) {
    return 0
  }
  return Math.round((value / total) * 100)
}

function sortStatusItems(items: ChartItem[]): ChartItem[] {
  return [...items].sort((a, b) => {
    const orderA = STATUS_VISUALS[a.stringAttr]?.order ?? 99
    const orderB = STATUS_VISUALS[b.stringAttr]?.order ?? 99
    return orderA - orderB
  })
}

export function DashboardPage() {
  const { t } = useTranslation()
  const { data, isLoading, error, refetch, isFetching } = useDeviceSummaryQuery()

  if (isLoading) {
    return <DashboardSkeleton t={t} />
  }

  if (error || !data) {
    return (
      <div className={APP_PAGE_CONTAINER_CLASS}>
        <div className={cn(BENTO_PANEL_CLASS, 'border-destructive/40')}>
          <h2 className="text-lg font-semibold text-destructive">{t('dashboard.errorTitle')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('dashboard.errorDescription')}</p>
          <Button type="button" variant="outline" className="mt-4" onClick={() => void refetch()}>
            {t('dashboard.retry')}
          </Button>
        </div>
      </div>
    )
  }

  const online = data.statusSummary.find((s) => s.stringAttr === 'green')?.number ?? 0
  const offline = data.statusSummary
    .filter((s) => s.stringAttr === 'yellow' || s.stringAttr === 'red')
    .reduce((sum, item) => sum + item.number, 0)

  const statusItems = sortStatusItems(data.statusSummary)
  const statusTotal = statusItems.reduce((sum, item) => sum + item.number, 0)
  const installItems = [...data.installSummary].sort((a, b) => b.number - a.number)
  const installTotal = installItems.reduce((sum, item) => sum + item.number, 0)

  return (
    <div className={cn(APP_PAGE_CONTAINER_CLASS, 'space-y-8')}>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t('dashboard.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('dashboard.subtitle')}</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title={t('dashboard.stats.total')}
          value={data.devicesTotal}
          hint={t('dashboard.stats.totalHint')}
          icon={Smartphone}
        />
        <KpiCard
          title={t('dashboard.stats.enrolled')}
          value={data.devicesEnrolled}
          hint={t('dashboard.stats.enrolledHint')}
          icon={CheckCircle2}
        />
        <KpiCard
          title={t('dashboard.stats.enrolledMonth')}
          value={data.devicesEnrolledLastMonth}
          hint={t('dashboard.stats.enrolledMonthHint')}
          icon={TrendingUp}
        />
        <KpiCard
          title={t('dashboard.stats.online')}
          value={online}
          hint={t('dashboard.stats.onlineHint', { offline })}
          icon={Activity}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className={BENTO_PANEL_CLASS}>
          <div className="mb-6 space-y-1">
            <h2 className="text-lg font-semibold tracking-tight">{t('dashboard.statusTitle')}</h2>
            <p className="text-sm text-muted-foreground">{t('dashboard.statusDescription')}</p>
          </div>

          {statusTotal > 0 ? (
            <div className="space-y-6">
              <div
                className="flex h-3 w-full overflow-hidden rounded-full bg-muted/40 dark:bg-white/5"
                role="img"
                aria-label={t('dashboard.statusTitle')}
              >
                {statusItems.map((item) => {
                  const percent = formatPercent(item.number, statusTotal)
                  if (percent <= 0) {
                    return null
                  }
                  const visual = STATUS_VISUALS[item.stringAttr] ?? STATUS_VISUALS.grey
                  return (
                    <div
                      key={item.stringAttr}
                      className={cn('h-full transition-[width]', visual.barClass)}
                      style={{ width: `${percent}%` }}
                      title={`${statusLabel(t, item.stringAttr)}: ${item.number}`}
                    />
                  )
                })}
              </div>

              <div className="space-y-4">
                {statusItems.map((item) => {
                  const percent = formatPercent(item.number, statusTotal)
                  const visual = STATUS_VISUALS[item.stringAttr] ?? STATUS_VISUALS.grey
                  return (
                    <div key={item.stringAttr} className="space-y-2">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className={cn('size-2.5 shrink-0 rounded-full', visual.dotClass)} />
                          <span className="truncate text-muted-foreground">
                            {statusLabel(t, item.stringAttr)}
                          </span>
                        </div>
                        <span className="shrink-0 tabular-nums text-foreground">
                          {t('dashboard.statusCount', {
                            count: item.number,
                            percent,
                          })}
                        </span>
                      </div>
                      <Progress value={percent} className="gap-0">
                        <ProgressTrack className="h-2 bg-muted/40 dark:bg-white/5">
                          <ProgressIndicator className={visual.barClass} />
                        </ProgressTrack>
                      </Progress>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t('dashboard.statusEmpty')}</p>
          )}
        </section>

        <section className={BENTO_PANEL_CLASS}>
          <div className="mb-6 space-y-1">
            <h2 className="text-lg font-semibold tracking-tight">{t('dashboard.installTitle')}</h2>
            <p className="text-sm text-muted-foreground">{t('dashboard.installDescription')}</p>
          </div>

          {installItems.length > 0 ? (
            <div className="space-y-5">
              {installItems.map((item) => {
                const percent = formatPercent(item.number, installTotal)
                const tone = resolveInstallTone(normalizeInstallKey(item.stringAttr))
                const visual = INSTALL_VISUALS[tone]
                return (
                  <div key={item.stringAttr} className="space-y-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
                          visual.badgeClass,
                        )}
                      >
                        {installLabel(t, item.stringAttr)}
                      </span>
                      <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                        {item.number}
                      </span>
                    </div>
                    <Progress value={percent} className="gap-0">
                      <ProgressTrack className="h-2.5 bg-muted/40 dark:bg-white/5">
                        <ProgressIndicator className={visual.barClass} />
                      </ProgressTrack>
                    </Progress>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t('dashboard.installEmpty')}</p>
          )}
        </section>
      </div>

      {isFetching ? (
        <p className="text-xs text-muted-foreground">{t('dashboard.refreshing')}</p>
      ) : null}
    </div>
  )
}

function KpiCard({
  title,
  value,
  hint,
  icon: Icon,
}: {
  title: string
  value: number
  hint: string
  icon: LucideIcon
}) {
  return (
    <article className={cn(BENTO_PANEL_CLASS, 'relative overflow-hidden')}>
      <Icon className="absolute right-5 top-5 size-5 text-slate-500" aria-hidden="true" />
      <p className="pr-10 text-sm font-medium text-muted-foreground">{title}</p>
      <p className="mt-3 text-4xl font-bold tabular-nums tracking-tight text-foreground">{value}</p>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{hint}</p>
    </article>
  )
}

function DashboardSkeleton({ t }: { t: TFunction }) {
  return (
    <div className={cn(APP_PAGE_CONTAINER_CLASS, 'space-y-8')}>
      <header className="space-y-2">
        <div className="h-8 w-40 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-72 animate-pulse rounded-md bg-muted/70" />
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className={cn(BENTO_PANEL_CLASS, 'space-y-3')}>
            <div className="h-4 w-28 animate-pulse rounded bg-muted/70" />
            <div className="h-10 w-20 animate-pulse rounded bg-muted" />
            <div className="h-3 w-full animate-pulse rounded bg-muted/50" />
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <div key={index} className={cn(BENTO_PANEL_CLASS, 'space-y-4')}>
            <div className="space-y-2">
              <div className="h-5 w-36 animate-pulse rounded bg-muted" />
              <div className="h-4 w-56 animate-pulse rounded bg-muted/70" />
            </div>
            <div className="h-3 w-full animate-pulse rounded-full bg-muted/50" />
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((__, row) => (
                <div key={row} className="h-8 animate-pulse rounded bg-muted/40" />
              ))}
            </div>
          </div>
        ))}
      </div>

      <p className="sr-only">{t('dashboard.loading')}</p>
    </div>
  )
}
