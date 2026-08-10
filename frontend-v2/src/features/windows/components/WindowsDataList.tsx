import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Single outer shell for Windows admin lists — no nested borders inside. */
export const WINDOWS_DATA_LIST_SHELL_CLASS =
  'overflow-hidden rounded-xl border border-border/80 bg-card shadow-none ring-0 dark:border-white/10'

const WINDOWS_DATA_LIST_SCROLL_CLASS = 'overflow-x-auto max-md:overflow-x-auto'

const WINDOWS_DATA_LIST_ROW_DIVIDER = 'border-b border-border/40 dark:border-white/5'

/** Applications: name · version · count · updated · actions */
export const WINDOWS_GRID_APPS =
  'grid-cols-[minmax(240px,2fr)_minmax(6.5rem,1fr)_minmax(4.5rem,0.65fr)_minmax(9rem,1fr)_auto]'

/** Configurations: name · status · updated · actions */
export const WINDOWS_GRID_CONFIGS =
  'grid-cols-[minmax(260px,2fr)_minmax(6.5rem,1fr)_minmax(9rem,1fr)_auto]'

/** Files: name · size · uploaded · sha256 · actions */
export const WINDOWS_GRID_FILES =
  'grid-cols-[minmax(200px,1.5fr)_minmax(5rem,0.65fr)_minmax(9rem,1fr)_minmax(10rem,1.15fr)_auto]'

/** Groups: name · description · devices · configuration · actions */
export const WINDOWS_GRID_GROUPS =
  'grid-cols-[minmax(10rem,1.1fr)_minmax(14rem,2fr)_minmax(3.5rem,0.45fr)_minmax(9rem,1fr)_auto]'

const GRID_ROW_BASE =
  'grid items-center gap-x-4 gap-y-1 px-4 text-sm max-md:min-w-[52rem] max-md:[&>*:nth-child(n+3)]:text-xs'

interface WindowsDataListProps {
  children: ReactNode
  className?: string
  'aria-label'?: string
}

export function WindowsDataList({ children, className, 'aria-label': ariaLabel }: WindowsDataListProps) {
  return (
    <div className={cn(WINDOWS_DATA_LIST_SHELL_CLASS, className)}>
      <div className={WINDOWS_DATA_LIST_SCROLL_CLASS} role="table" aria-label={ariaLabel}>
        {children}
      </div>
    </div>
  )
}

interface WindowsDataListPanelProps {
  children: ReactNode
  className?: string
}

/** Loading, empty, and error states using the same outer shell as WindowsDataList. */
export function WindowsDataListPanel({ children, className }: WindowsDataListPanelProps) {
  return <div className={cn(WINDOWS_DATA_LIST_SHELL_CLASS, className)}>{children}</div>
}

interface WindowsDataListHeaderProps {
  gridClass: string
  children: ReactNode
  className?: string
}

export function WindowsDataListHeader({ gridClass, children, className }: WindowsDataListHeaderProps) {
  return (
    <div
      role="row"
      className={cn(
        GRID_ROW_BASE,
        WINDOWS_DATA_LIST_ROW_DIVIDER,
        'py-3 font-medium text-muted-foreground',
        gridClass,
        className,
      )}
    >
      {children}
    </div>
  )
}

interface WindowsDataListBodyProps {
  children: ReactNode
  className?: string
}

export function WindowsDataListBody({ children, className }: WindowsDataListBodyProps) {
  return (
    <div role="rowgroup" className={cn('[&>[role=row]:last-child]:border-b-0', className)}>
      {children}
    </div>
  )
}

interface WindowsDataListRowProps {
  gridClass: string
  children: ReactNode
  className?: string
  onClick?: () => void
}

export function WindowsDataListRow({ gridClass, children, className, onClick }: WindowsDataListRowProps) {
  return (
    <div
      role="row"
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onClick()
              }
            }
          : undefined
      }
      className={cn(
        GRID_ROW_BASE,
        WINDOWS_DATA_LIST_ROW_DIVIDER,
        'py-3 last:border-b-0',
        onClick && 'cursor-pointer transition-colors hover:bg-muted/20',
        gridClass,
        className,
      )}
    >
      {children}
    </div>
  )
}

interface WindowsDataListCellProps {
  children: ReactNode
  className?: string
  role?: 'cell' | 'columnheader'
  onClick?: (event: React.MouseEvent<HTMLDivElement>) => void
}

export function WindowsDataListCell({ children, className, role = 'cell', onClick }: WindowsDataListCellProps) {
  return (
    <div role={role} className={cn('min-w-0', className)} onClick={onClick}>
      {children}
    </div>
  )
}

interface WindowsDataListEmptyProps {
  children: ReactNode
  className?: string
}

export function WindowsDataListEmpty({ children, className }: WindowsDataListEmptyProps) {
  return (
    <div className={cn('px-4 py-10 text-center text-sm text-muted-foreground', className)} role="row">
      <div role="cell">{children}</div>
    </div>
  )
}
