import { cn } from '@/lib/utils'

/** Shared geometry for Windows and Android device detail pages. */
export const DEVICE_DETAIL_CONTAINER_CLASS =
  'mx-auto w-full max-w-[1280px] px-4 md:px-6 lg:px-8'

export const deviceDetailSectionClass = (className?: string) =>
  cn(
    'rounded-xl border border-border/80 bg-card p-5 shadow-none dark:border-[#242424] dark:bg-[#111111]',
    className,
  )

export const DEVICE_OVERVIEW_GRID_CLASS = 'grid gap-5 lg:grid-cols-2'

export const TAB_CONTENT_CLASS =
  'mt-0 h-auto w-full flex-none overflow-visible focus-visible:outline-none'

export const TAB_LIST_CLASS =
  'h-auto w-full flex-wrap justify-start gap-1 border-b border-border/80 pb-px dark:border-[#242424] [&_[data-slot=tabs-trigger]]:flex-none'
