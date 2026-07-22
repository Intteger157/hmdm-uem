import { cn } from '@/lib/utils'

type WindowsIconProps = {
  className?: string
}

export function WindowsIcon({ className }: WindowsIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={cn('size-4 shrink-0', className)}
      fill="currentColor"
    >
      <path d="M3 5.5 10.5 4.2v7.6H3V5.5zm0 8.7h7.5v7.6L3 20.5V14.2zm8.25-10.11L21 2.5v9.25h-9.75V4.09zm0 10.16H21V22l-9.75-1.66V14.25z" />
    </svg>
  )
}
