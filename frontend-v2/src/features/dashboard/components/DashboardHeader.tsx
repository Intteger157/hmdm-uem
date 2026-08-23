import { useNavigate } from '@tanstack/react-router'
import { RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { formatRelativeTimeI18n } from '@/features/dashboard/lib/format-relative-time'
import { dashboardEnterClass } from '@/features/dashboard/lib/dashboard-styles'
import { usePermissions } from '@/features/auth/hooks/use-permissions'
import type { Platform } from '@/shared/api/types/platform'
import { cn } from '@/lib/utils'

interface DashboardHeaderProps {
  platform: Platform
  dataUpdatedAt: number
  isFetching: boolean
  onRefresh: () => void
}

export function DashboardHeader({
  platform,
  dataUpdatedAt,
  isFetching,
  onRefresh,
}: DashboardHeaderProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { lockedPlatform, allowsPlatform } = usePermissions()
  const lastUpdated =
    dataUpdatedAt > 0
      ? formatRelativeTimeI18n(dataUpdatedAt, t)
      : t('dashboard.header.neverUpdated')

  const showPlatformSwitcher =
    lockedPlatform == null && allowsPlatform('android') && allowsPlatform('windows')

  const handlePlatformChange = (next: Platform) => {
    void navigate({
      to: '/dashboard',
      search: { platform: next },
    })
  }

  return (
    <header
      className={cn(
        'flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between',
        dashboardEnterClass(),
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
            {t('dashboard.title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {platform === 'windows' ? t('dashboard.subtitleWindows') : t('dashboard.subtitleAndroid')}
          </p>
        </div>

        {showPlatformSwitcher ? (
          <div className="flex rounded-lg border p-1">
            <Button
              type="button"
              size="sm"
              variant={platform === 'android' ? 'default' : 'ghost'}
              onClick={() => handlePlatformChange('android')}
            >
              Android
            </Button>
            <Button
              type="button"
              size="sm"
              variant={platform === 'windows' ? 'default' : 'ghost'}
              onClick={() => handlePlatformChange('windows')}
            >
              Windows
            </Button>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <span>{t('dashboard.header.lastUpdated', { time: lastUpdated })}</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-2"
          disabled={isFetching}
          onClick={onRefresh}
        >
          <RefreshCw className={cn('size-3.5', isFetching && 'animate-spin')} />
          {t('dashboard.header.refresh')}
        </Button>
      </div>
    </header>
  )
}
