import type { SVGProps } from 'react'
import { cn } from '@/lib/utils'

export const ANDROID_BRAND_COLOR = 'text-[#3DDC84]'
export const WINDOWS_BRAND_COLOR = 'text-[#00A4EF]'

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

export function AndroidIcon({ className, ...props }: IconProps) {
  return (
    <BrandSvg className={className} {...props}>
      <path d="M17.523 15.341c-.551 0-.999-.449-.999-1s.448-1 .999-1 .999.449.999 1-.448 1-.999 1m-11.046 0c-.551 0-.999-.449-.999-1s.448-1 .999-1 .999.449.999 1-.448 1-.999 1m11.405-6.02 1.997-3.459a.416.416 0 0 0-.152-.568.416.416 0 0 0-.568.152l-2.022 3.503C15.59 8.244 13.853 7.851 12 7.851s-3.59.393-5.137 1.099L4.841 5.447a.416.416 0 0 0-.568-.152.416.416 0 0 0-.152.568l1.997 3.459C2.689 11.187.343 14.659 0 18.761h24c-.343-4.102-2.689-7.574-6.119-9.44" />
    </BrandSvg>
  )
}

export function WindowsIcon({ className, ...props }: IconProps) {
  return (
    <BrandSvg className={className} {...props}>
      <path d="M3 3h8v8H3V3zm0 10h8v8H3v-8zm10-10h8v8h-8V3zm0 10h8v8h-8v-8z" />
    </BrandSvg>
  )
}

export function BatteryStatusIcon({ className, ...props }: IconProps) {
  return (
    <BrandSvg className={className} {...props}>
      <path d="M7 7h10a2 2 0 0 1 2 2v.25H19a1 1 0 0 1 0 2h-.25V15a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2zm0 2v8h10V9H7z" />
    </BrandSvg>
  )
}
