import type { SVGProps } from 'react'
import { cn } from '@/lib/utils'

export const ANDROID_BRAND_COLOR = 'text-[#3DDC84]'

type IconProps = SVGProps<SVGSVGElement>

function BrandSvg({ className, children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="currentColor"
      className={cn('size-4 shrink-0', className)}
      {...props}
    >
      {children}
    </svg>
  )
}

/** Symmetric Bugdroid (Material baseline) — upright at sidebar size. */
export function AndroidIcon({ className, ...props }: IconProps) {
  return (
    <BrandSvg className={className} {...props}>
      <path d="M6 18c0 .55.45 1 1 1h1v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h2v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h1c.55 0 1-.45 1-1V8H6v10zM3.5 8C2.67 8 2 8.67 2 9.5v7c0 .83.67 1.5 1.5 1.5S5 17.33 5 16.5v-7C5 8.67 4.33 8 3.5 8zm17 0c-.83 0-1.5.67-1.5 1.5v7c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5v-7c0-.83-.67-1.5-1.5-1.5zm-4.97-5.84 1.3-1.3c.2-.2.2-.51 0-.71-.2-.2-.51-.2-.71 0l-1.48 1.48C13.85 1.23 12.95 1 12 1c-.96 0-1.86.23-2.66.63L7.85.15c-.2-.2-.51-.2-.71 0-.2.2-.2.51 0 .71l1.31 1.31C6.97 3.26 6 5.01 6 7h12c0-1.99-.97-3.75-2.47-4.84zM10 5H9V4h1v1zm5 0h-1V4h1v1z" />
    </BrandSvg>
  )
}

/** Windows logo — perspective via pane offsets, axis-aligned for crisp 16px render. */
export function WindowsIcon({ className, ...props }: IconProps) {
  return (
    <BrandSvg className={className} {...props}>
      <rect x="2" y="4" width="9" height="8" />
      <rect x="13" y="3" width="9" height="9" />
      <rect x="2" y="13" width="9" height="8" />
      <rect x="13" y="12" width="9" height="9" />
    </BrandSvg>
  )
}

type BatteryLevelIconProps = IconProps & {
  level: number
}

/** Vertical battery with fill level (0–100), similar to classic status-bar icon. */
export function BatteryLevelIcon({ level, className, ...props }: BatteryLevelIconProps) {
  const clamped = Math.max(0, Math.min(100, level))
  const innerX = 8.25
  const innerY = 7.25
  const innerW = 7.5
  const innerH = 13.5
  const fillH = (clamped / 100) * innerH
  const fillY = innerY + innerH - fillH

  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      shapeRendering="geometricPrecision"
      className={cn('size-5 shrink-0', className)}
      {...props}
    >
      <rect x="9.5" y="3.5" width="5" height="2" rx="0.75" className="fill-muted-foreground/70" />
      <rect
        x="6.75"
        y="6"
        width="10.5"
        height="15"
        rx="2"
        className="fill-none stroke-muted-foreground"
        strokeWidth="1.5"
      />
      <rect x={innerX} y={innerY} width={innerW} height={innerH} rx="1" className="fill-background" />
      {fillH > 0 ? (
        <rect x={innerX} y={fillY} width={innerW} height={fillH} rx="1" className="fill-[#3DDC84]" />
      ) : null}
    </svg>
  )
}
