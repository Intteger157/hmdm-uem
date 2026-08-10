import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Page layout width variants — pick by content type, not one size for everything.
 *
 * | Size      | Use for                                      | Width                         |
 * |-----------|----------------------------------------------|-------------------------------|
 * | default   | Settings, forms, editors, enrollment cards   | max-w-[1280px], centered      |
 * | detail    | Device detail / overview                     | max-w-[1280px], centered      |
 * | wide      | Device lists, admin tables, data-heavy pages | max-w-[1600px], centered      |
 * | full      | Dashboard, charts, fleet analytics           | w-full (no max-width cap)     |
 */
export type PageContainerSize = 'default' | 'wide' | 'full' | 'detail'

const PAGE_CONTAINER_SIZE_CLASS: Record<PageContainerSize, string> = {
  default: 'max-w-[1280px] gap-4',
  detail: 'max-w-[1280px] gap-5',
  wide: 'w-full max-w-[1600px] gap-4',
  full: 'w-full max-w-none gap-6',
}

export const PAGE_CONTAINER_BASE_CLASS = 'mx-auto flex w-full flex-col'

export function pageContainerClass(size: PageContainerSize = 'default', className?: string) {
  return cn(PAGE_CONTAINER_BASE_CLASS, PAGE_CONTAINER_SIZE_CLASS[size], className)
}

/** Constrained column for forms and readable content (Settings, editors). */
export const APP_PAGE_CONTAINER_CLASS = pageContainerClass('default')

interface PageContainerProps {
  children: ReactNode
  /** @alias size — layout width variant */
  size?: PageContainerSize
  variant?: PageContainerSize
  className?: string
}

export function PageContainer({
  children,
  size,
  variant,
  className,
}: PageContainerProps) {
  const resolved = variant ?? size ?? 'default'
  return <div className={pageContainerClass(resolved, className)}>{children}</div>
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

/** Table wrapper — horizontal scroll only when the viewport cannot fit columns. */
export const DATA_TABLE_WRAPPER_CLASS =
  'overflow-x-auto rounded-lg border border-border bg-card shadow-none ring-0 max-md:overflow-x-auto'

export const DATA_TABLE_CLASS = 'w-full table-auto text-left text-sm'

/** Shrink-to-fit columns (status, actions, badges, numeric flags). */
export const DATA_TABLE_COL_COMPACT = 'w-[1%] whitespace-nowrap'

/** Medium columns (dates, platform, version) — content-sized, no stretch. */
export const DATA_TABLE_COL_MEDIUM = 'w-[1%] whitespace-nowrap'

/** Flexible columns — absorb remaining width; apply truncate on cell content if needed. */
export const DATA_TABLE_COL_FLEX = 'min-w-[7rem]'

/** @deprecated Use DATA_TABLE_COL_FLEX — old name implied a max-width cap. */
export const DATA_TABLE_COL_GROW = DATA_TABLE_COL_FLEX

export const FORM_FIELD_NARROW_CLASS = 'max-w-xs'
export const FORM_FIELD_MEDIUM_CLASS = 'max-w-md'
export const FORM_FIELD_WIDE_CLASS = 'max-w-xl'
