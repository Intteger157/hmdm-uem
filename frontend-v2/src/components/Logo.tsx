import { cn } from '@/lib/utils'

const LOGO_SRC = '/logo.svg'

type LogoSize = 'sm' | 'md' | 'lg' | 'xl'

const sizeClasses: Record<LogoSize, string> = {
  sm: 'size-9',
  md: 'size-16',
  lg: 'size-28',
  xl: 'size-36',
}

interface LogoProps {
  size?: LogoSize
  className?: string
  alt?: string
}

export function Logo({ size = 'md', className, alt = '' }: LogoProps) {
  return (
    <img
      src={LOGO_SRC}
      alt={alt}
      className={cn('object-contain', sizeClasses[size], className)}
    />
  )
}
