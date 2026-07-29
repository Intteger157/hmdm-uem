import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface WindowsConfigEditorNavIndicatorProps {
  count?: number
  active?: boolean
}

export function WindowsConfigEditorNavIndicator({
  count,
  active = false,
}: WindowsConfigEditorNavIndicatorProps) {
  if (count == null || count <= 0) {
    return null
  }

  if (count > 1) {
    return (
      <span
        className={cn(
          'ml-auto inline-flex min-w-5 items-center justify-center px-1.5 text-xs tabular-nums',
          active ? 'text-zinc-100' : 'text-zinc-500',
        )}
      >
        {count}
      </span>
    )
  }

  return (
    <span
      className={cn('ml-auto size-1.5 shrink-0 rounded-full', active ? 'bg-zinc-300' : 'bg-zinc-600')}
      aria-hidden
    />
  )
}

interface WindowsConfigEditorEmptyStateProps {
  icon: ReactNode
  title: string
  description: string
  action: ReactNode
}

export function WindowsConfigEditorEmptyState({
  icon,
  title,
  description,
  action,
}: WindowsConfigEditorEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center border border-dashed border-zinc-700/80 px-6 py-14 text-center">
      <div className="mb-4 text-zinc-600">{icon}</div>
      <p className="text-sm font-medium text-zinc-200">{title}</p>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      <div className="mt-6">{action}</div>
    </div>
  )
}
