import { useTranslation } from 'react-i18next'
import type { FleetHealthBucket } from '@/features/dashboard/lib/dashboard-metrics'
import { dashboardEnterClass, dashboardSectionClass } from '@/features/dashboard/lib/dashboard-styles'
import { cn } from '@/lib/utils'

const BUCKET_STYLES: Record<
  FleetHealthBucket['key'],
  { bar: string; dot: string; ring: string }
> = {
  healthy: {
    bar: 'bg-emerald-500/85',
    dot: 'bg-emerald-500',
    ring: 'stroke-emerald-500/85',
  },
  atRisk: {
    bar: 'bg-amber-500/85',
    dot: 'bg-amber-500',
    ring: 'stroke-amber-500/85',
  },
  offline: {
    bar: 'bg-slate-600/90',
    dot: 'bg-slate-500',
    ring: 'stroke-slate-500/85',
  },
  notEnrolled: {
    bar: 'bg-zinc-700/90',
    dot: 'bg-zinc-600',
    ring: 'stroke-zinc-600/85',
  },
}

interface DashboardFleetHealthProps {
  buckets: FleetHealthBucket[]
  total: number
}

export function DashboardFleetHealth({ buckets, total }: DashboardFleetHealthProps) {
  const { t } = useTranslation()

  const labelFor = (key: FleetHealthBucket['key']) => t(`dashboard.fleetHealth.${key}`)

  return (
    <section className={cn(dashboardSectionClass(), dashboardEnterClass(3))}>
      <div className="mb-6">
        <h2 className="text-lg font-semibold tracking-tight">{t('dashboard.fleetHealth.title')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('dashboard.fleetHealth.description')}</p>
      </div>

      {total <= 0 ? (
        <p className="text-sm text-muted-foreground">{t('dashboard.empty.noDevices')}</p>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[220px_1fr] lg:items-center">
          <FleetHealthRing
            buckets={buckets}
            total={total}
            totalLabel={t('dashboard.fleetHealth.totalLabel')}
          />

          <div className="space-y-5">
            <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted/40 dark:bg-white/5">
              {buckets.map((bucket) => {
                if (bucket.count <= 0) {
                  return null
                }
                const style = BUCKET_STYLES[bucket.key]
                return (
                  <div
                    key={bucket.key}
                    className={cn('h-full transition-[width] duration-500', style.bar)}
                    style={{ width: `${bucket.percent}%` }}
                  />
                )
              })}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {buckets.map((bucket) => {
                const style = BUCKET_STYLES[bucket.key]
                return (
                  <div
                    key={bucket.key}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2.5 dark:border-[#242424]"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className={cn('size-2 shrink-0 rounded-full', style.dot)} />
                      <span className="truncate text-sm text-muted-foreground">
                        {labelFor(bucket.key)}
                      </span>
                    </div>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                      {bucket.count}
                      <span className="ml-1.5 font-normal text-muted-foreground">
                        ({bucket.percent}%)
                      </span>
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

function FleetHealthRing({
  buckets,
  total,
  totalLabel,
}: {
  buckets: FleetHealthBucket[]
  total: number
  totalLabel: string
}) {
  const radius = 54
  const circumference = 2 * Math.PI * radius
  let offset = 0

  return (
    <div className="relative mx-auto flex size-44 items-center justify-center">
      <svg viewBox="0 0 128 128" className="size-full -rotate-90">
        <circle
          cx="64"
          cy="64"
          r={radius}
          fill="none"
          className="stroke-muted/30 dark:stroke-white/5"
          strokeWidth="12"
        />
        {buckets.map((bucket) => {
          if (bucket.count <= 0 || total <= 0) {
            return null
          }
          const segment = (bucket.count / total) * circumference
          const dasharray = `${segment} ${circumference - segment}`
          const dashoffset = -offset
          offset += segment
          const style = BUCKET_STYLES[bucket.key]
          return (
            <circle
              key={bucket.key}
              cx="64"
              cy="64"
              r={radius}
              fill="none"
              className={cn('transition-all duration-500', style.ring)}
              strokeWidth="12"
              strokeLinecap="butt"
              strokeDasharray={dasharray}
              strokeDashoffset={dashoffset}
            />
          )
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-3xl font-bold tabular-nums">{total}</span>
        <span className="text-xs text-muted-foreground">{totalLabel}</span>
      </div>
    </div>
  )
}
