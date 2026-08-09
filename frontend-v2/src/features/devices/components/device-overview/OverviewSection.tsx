import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { deviceDetailSectionClass } from '@/features/devices/components/device-overview/device-detail-layout-styles'

interface OverviewSectionProps {
  title: string
  description?: string
  children: ReactNode
  className?: string
  action?: ReactNode
}

export function OverviewSection({
  title,
  description,
  children,
  className,
  action,
}: OverviewSectionProps) {
  return (
    <section className={cn(deviceDetailSectionClass(), className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-foreground">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {action}
      </div>
      <div className="space-y-0">{children}</div>
    </section>
  )
}

interface OverviewFieldRowProps {
  label: string
  value: ReactNode
  mono?: boolean
  secondary?: ReactNode
  action?: ReactNode
  copyValue?: string
  tooltip?: string
}

export function OverviewFieldRow({
  label,
  value,
  mono,
  secondary,
  action,
  copyValue,
}: OverviewFieldRowProps) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/50 py-3 last:border-b-0 dark:border-[#242424]/80">
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div
          className={cn(
            'mt-0.5 text-sm font-medium text-foreground',
            mono && 'font-mono text-[13px]',
          )}
        >
          {value ?? '—'}
        </div>
        {secondary ? <div className="mt-1 text-xs text-muted-foreground">{secondary}</div> : null}
      </div>
      {(action || copyValue) && (
        <div className="flex shrink-0 items-center gap-1 pt-4">{action}</div>
      )}
    </div>
  )
}

interface OverviewTelemetryProps {
  label: string
  valueLabel: string
  percent?: number
  secondary?: ReactNode
  action?: ReactNode
  tone?: 'default' | 'warning' | 'success'
}

export function OverviewTelemetry({
  label,
  valueLabel,
  percent,
  secondary,
  action,
  tone = 'default',
}: OverviewTelemetryProps) {
  const barClass =
    tone === 'success'
      ? 'bg-emerald-500/80'
      : tone === 'warning'
        ? 'bg-amber-500/80'
        : 'bg-violet-500/70'

  return (
    <div className="border-b border-border/50 py-3 last:border-b-0 dark:border-[#242424]/80">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-0.5 text-sm font-medium tabular-nums text-foreground">{valueLabel}</p>
          {secondary ? <p className="mt-0.5 text-xs text-muted-foreground">{secondary}</p> : null}
        </div>
        {action}
      </div>
      {percent != null ? (
        <div className="h-1.5 overflow-hidden rounded-full bg-muted/50 dark:bg-white/5">
          <div
            className={cn('h-full rounded-full transition-all duration-500', barClass)}
            style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
          />
        </div>
      ) : null}
    </div>
  )
}

interface OverviewStatusRowProps {
  label: string
  status: 'healthy' | 'warning' | 'critical' | 'neutral'
  title: string
  detail?: ReactNode
  action?: ReactNode
}

const STATUS_DOT = {
  healthy: 'bg-emerald-500',
  warning: 'bg-amber-500',
  critical: 'bg-rose-500',
  neutral: 'bg-slate-500',
} as const

export function OverviewStatusRow({
  label,
  status,
  title,
  detail,
  action,
}: OverviewStatusRowProps) {
  return (
    <div className="border-b border-border/50 py-3 last:border-b-0 dark:border-[#242424]/80">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-1.5 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', STATUS_DOT[status])} />
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">{title}</p>
            {detail ? <div className="mt-1 text-xs text-muted-foreground">{detail}</div> : null}
          </div>
        </div>
        {action}
      </div>
    </div>
  )
}
