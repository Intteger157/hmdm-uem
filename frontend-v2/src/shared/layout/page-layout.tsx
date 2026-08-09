import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Layout geometry aligned with Windows Enrollment (`WindowsEnrollmentPage`):
 * - centered column, not full viewport width
 * - `max-w-5xl` (~1024px) for standard admin pages
 * - compact vertical rhythm (`gap-4`)
 * - flat bordered cards (`PAGE_FLAT_CARD_CLASS`)
 */
export type PageContainerSize = 'default' | 'wide' | 'detail'

const PAGE_CONTAINER_SIZE_CLASS: Record<PageContainerSize, string> = {
  default: 'max-w-5xl gap-4',
  wide: 'max-w-[1400px] gap-6',
  detail: 'max-w-[1280px] gap-5',
}

export const PAGE_CONTAINER_BASE_CLASS = 'mx-auto flex w-full flex-col'

export function pageContainerClass(size: PageContainerSize = 'default', className?: string) {
  return cn(PAGE_CONTAINER_BASE_CLASS, PAGE_CONTAINER_SIZE_CLASS[size], className)
}

/** @deprecated Use `pageContainerClass('default')` — kept for gradual migration. */
export const APP_PAGE_CONTAINER_CLASS = pageContainerClass('default')

interface PageContainerProps {
  children: ReactNode
  size?: PageContainerSize
  className?: string
}

export function PageContainer({ children, size = 'default', className }: PageContainerProps) {
  return <div className={pageContainerClass(size, className)}>{children}</div>
}

interface PageHeaderProps {
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
  className?: string
}

export function PageHeader({ title, description, children, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between',
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>
        {description ? (
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children ? <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  )
}

interface PageToolbarProps {
  children: ReactNode
  className?: string
}

/** Search / filters row with optional primary action on the right. */
export function PageToolbar({ children, className }: PageToolbarProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      {children}
    </div>
  )
}

/** Enrollment-style flat card — no shadow, subtle border only. */
export const PAGE_FLAT_CARD_CLASS = 'border border-border bg-card shadow-none ring-0'

export const DATA_TABLE_WRAPPER_CLASS =
  'overflow-x-auto rounded-lg border border-border bg-card shadow-none ring-0'

export const DATA_TABLE_CLASS = 'w-full table-auto text-left text-sm'

/** Shrink-to-fit columns (status, actions, dates, badges). */
export const DATA_TABLE_COL_COMPACT = 'w-[1%] whitespace-nowrap'

/** Long text columns — truncate with native title tooltip on cell content. */
export const DATA_TABLE_COL_GROW = 'max-w-[14rem]'

export const FORM_FIELD_NARROW_CLASS = 'max-w-xs'
export const FORM_FIELD_MEDIUM_CLASS = 'max-w-md'
export const FORM_FIELD_WIDE_CLASS = 'max-w-xl'
