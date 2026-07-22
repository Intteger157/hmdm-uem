import { cn } from '@/lib/utils'

type AndroidIconProps = {
  className?: string
}

export function AndroidIcon({ className }: AndroidIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={cn('size-4 shrink-0', className)}
      fill="currentColor"
    >
      <path d="M17.6 9.48l1.84-3.18c.16-.28.06-.64-.22-.8-.28-.16-.64-.06-.8.22l-1.87 3.24a8.77 8.77 0 0 0-3.55 0L10.13 5.72c-.16-.28-.52-.38-.8-.22-.28.16-.38.52-.22.8l1.84 3.18a7.01 7.01 0 0 0-2.75 2.27H6.5c-.28 0-.5.22-.5.5v7c0 .28.22.5.5.5h1v2.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V20h5v2.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V20h1c.28 0 .5-.22.5-.5v-7c0-.28-.22-.5-.5-.5h-1.7a7.01 7.01 0 0 0-2.75-2.27zM8.5 14.25c-.41 0-.75-.34-.75-.75s.34-.75.75-.75.75.34.75.75-.34.75-.75.75zm7 0c-.41 0-.75-.34-.75-.75s.34-.75.75-.75.75.34.75.75-.34.75-.75.75z" />
    </svg>
  )
}
