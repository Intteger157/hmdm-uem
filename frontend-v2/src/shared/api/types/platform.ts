export type Platform = 'android' | 'windows'

export const PLATFORMS: Platform[] = ['android', 'windows']

export function isPlatform(value: string | undefined): value is Platform {
  return value === 'android' || value === 'windows'
}

export function isWindowsMdmEnabled(): boolean {
  return import.meta.env.VITE_WINDOWS_MDM_ENABLED === 'true'
}
