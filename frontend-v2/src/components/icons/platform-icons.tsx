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
      shapeRendering="geometricPrecision"
      className={cn('size-4 shrink-0', className)}
      {...props}
    >
      {children}
    </svg>
  )
}

/** Classic Bugdroid silhouette (single-color). */
export function AndroidIcon({ className, ...props }: IconProps) {
  return (
    <BrandSvg className={className} {...props}>
      <path d="M17.6 9.48 19.44 6.3c.16-.28.06-.64-.22-.8-.28-.16-.64-.06-.8.22l-1.87 3.24a8.77 8.77 0 0 0-3.55 0L10.13 5.72c-.16-.28-.52-.38-.8-.22-.28.16-.38.52-.22.8l1.84 3.18a7.01 7.01 0 0 0-2.75 2.27H6.5c-.28 0-.5.22-.5.5v7c0 .28.22.5.5.5h1v2.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V20h5v2.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V20h1c.28 0 .5-.22.5-.5v-7c0-.28-.22-.5-.5-.5h-1.7a7.01 7.01 0 0 0-2.75-2.27zM8.5 14.25c-.41 0-.75-.34-.75-.75s.34-.75.75-.75.75.34.75.75-.34.75-.75.75zm7 0c-.41 0-.75-.34-.75-.75s.34-.75.75-.75.75.34.75.75-.34.75-.75.75z" />
    </BrandSvg>
  )
}

/** Windows logo with perspective panes (single-color). */
export function WindowsIcon({ className, ...props }: IconProps) {
  return (
    <BrandSvg className={className} {...props}>
      <path d="M2.5 5.2 10.8 4.1v7.4L2.5 12.6V5.2zm0 9.2 8.3-.9v7.2l-8.3 1.1v-7.4zm10.1-10.3 8.4-1.3v7.2l-8.4 1.2V4.1zm0 9.1 8.4-1.2v7.2l-8.4 1.3v-7.3z" />
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
