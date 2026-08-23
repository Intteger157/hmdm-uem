import type { Platform } from '@/shared/api/types/platform'

export function dashboardRouteSearch(platform: Platform = 'android') {
  return { platform }
}
