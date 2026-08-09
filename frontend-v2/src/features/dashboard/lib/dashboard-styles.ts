import { cn } from '@/lib/utils'

export const DASHBOARD_CONTAINER_CLASS =
  'mx-auto w-full max-w-[1400px] px-4 md:px-6 lg:px-8'

export const dashboardPanelClass = (className?: string) =>
  cn(
    'rounded-xl border border-border/80 bg-card shadow-none dark:border-[#242424] dark:bg-[#111111]',
    className,
  )

export const dashboardMetricCardClass = (className?: string) =>
  cn(
    dashboardPanelClass(),
    'p-5 transition-colors hover:border-border dark:hover:border-[#2A2A2A]',
    className,
  )

export const dashboardSectionClass = (className?: string) =>
  cn(dashboardPanelClass(), 'p-6', className)

export const dashboardAttentionCardClass = (className?: string) =>
  cn(
    dashboardMetricCardClass(),
    'border-amber-500/25 dark:border-amber-500/30',
    className,
  )

export const dashboardEnterClass = (step = 0) => {
  const delays = ['', 'delay-75', 'delay-150', 'delay-200', 'delay-300', 'delay-500']
  return cn(
    'animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-500',
    delays[step] ?? delays[delays.length - 1],
  )
}
