import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { sliceEnrollmentTrend } from '@/features/dashboard/lib/dashboard-metrics'
import { dashboardEnterClass, dashboardSectionClass } from '@/features/dashboard/lib/dashboard-styles'
import type { ChartItem } from '@/shared/api/types/summary'
import { cn } from '@/lib/utils'

type TrendRange = 7 | 30 | 90

interface DashboardEnrollmentTrendProps {
  monthly: ChartItem[]
}

export function DashboardEnrollmentTrend({ monthly }: DashboardEnrollmentTrendProps) {
  const { t } = useTranslation()
  const [range, setRange] = useState<TrendRange>(30)

  const points = useMemo(() => sliceEnrollmentTrend(monthly, range), [monthly, range])
  const maxValue = Math.max(...points.map((point) => point.number), 1)

  return (
    <section className={cn(dashboardSectionClass(), dashboardEnterClass(4))}>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{t('dashboard.activity.title')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('dashboard.activity.description')}</p>
        </div>
        <div className="flex rounded-lg border border-border/80 p-0.5 dark:border-[#242424]">
          {([7, 30, 90] as TrendRange[]).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setRange(option)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                range === option
                  ? 'bg-muted text-foreground dark:bg-white/10'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t(`dashboard.activity.range.${option}`)}
            </button>
          ))}
        </div>
      </div>

      {range === 7 ? (
        <div className="rounded-lg border border-dashed border-border/70 px-4 py-8 text-center dark:border-[#242424]">
          <p className="text-sm font-medium text-foreground">{t('dashboard.activity.dailyUnavailableTitle')}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('dashboard.activity.dailyUnavailableDescription')}
          </p>
        </div>
      ) : points.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/70 px-4 py-8 text-center dark:border-[#242424]">
          <p className="text-sm text-muted-foreground">{t('dashboard.activity.empty')}</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex h-44 items-end gap-3">
            {points.map((point) => {
              const height = Math.max(8, (point.number / maxValue) * 100)
              return (
                <div key={point.stringAttr} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                  <span className="text-xs font-medium tabular-nums text-muted-foreground">
                    {point.number}
                  </span>
                  <div
                    className="w-full rounded-t-md bg-violet-500/75 transition-all duration-500 dark:bg-violet-500/60"
                    style={{ height: `${height}%` }}
                  />
                  <span className="truncate text-[11px] text-muted-foreground">{point.stringAttr}</span>
                </div>
              )
            })}
          </div>
          <p className="text-xs text-muted-foreground">{t('dashboard.activity.monthlyNote')}</p>
        </div>
      )}
    </section>
  )
}
