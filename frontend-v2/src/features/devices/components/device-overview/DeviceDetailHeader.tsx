import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import {
  ChevronRight,
  Loader2,
  MoreHorizontal,
  RefreshCw,
  Zap,
} from 'lucide-react'
import type { TFunction } from 'i18next'
import { toast } from 'sonner'
import { OverviewCopyButton } from '@/features/devices/components/device-overview/OverviewCopyButton'
import { useDeviceConfigSyncMutation } from '@/features/devices/hooks/use-device-actions'
import {
  formatDeviceTimestamp,
} from '@/features/devices/utils/device-detail-formatters'
import { ANDROID_BRAND_COLOR, AndroidIcon, WindowsIcon } from '@/components/icons/platform-icons'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { DeviceView } from '@/shared/api/types/device'
import { cn } from '@/lib/utils'

const STATUS_BADGE: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  green: 'default',
  yellow: 'outline',
  red: 'destructive',
  brown: 'secondary',
  grey: 'secondary',
}

function deviceTitle(device: DeviceView): string {
  const pick = (...values: (string | null | undefined)[]) => {
    for (const value of values) {
      const trimmed = value?.trim()
      if (trimmed) {
        return trimmed
      }
    }
    return device.number
  }

  if (device.platform === 'windows') {
    return pick(device.hostname, device.model, device.number)
  }
  return pick(device.description, device.hostname, device.number)
}

function managementBadges(device: DeviceView, isWindows: boolean, t: TFunction) {
  const badges = []
  if (device.kioskMode) {
    badges.push(<Badge key="kiosk" variant="secondary">Kiosk</Badge>)
  }
  if (device.mdmMode) {
    badges.push(<Badge key="mdm" variant="secondary">MDM</Badge>)
  }
  if (!isWindows && device.configurationName) {
    badges.push(
      <Badge key="config" variant="outline" className="max-w-[180px] truncate">
        {device.configurationName}
      </Badge>,
    )
  }
  if (badges.length === 0) {
    badges.push(
      <Badge key="managed" variant="outline">
        {isWindows ? t('devices.subtitleWindows') : t('devices.subtitle')}
      </Badge>,
    )
  }
  return badges
}

interface DeviceDetailHeaderProps {
  device: DeviceView
  onlineStatus: string
  isFetching?: boolean
  onRefresh: () => void
  onOpenActions: () => void
}

export function DeviceDetailHeader({
  device,
  onlineStatus,
  isFetching,
  onRefresh,
  onOpenActions,
}: DeviceDetailHeaderProps) {
  const { t } = useTranslation()
  const syncMutation = useDeviceConfigSyncMutation()
  const isWindows = device.platform === 'windows'
  const title = deviceTitle(device)
  const model = device.model ?? device.manufacturer ?? device.info?.model
  const lastSeen = formatDeviceTimestamp(device.lastUpdate)

  const handleSync = () => {
    syncMutation.mutate(device.number, {
      onSuccess: () => toast.success(t('deviceDetail.overview.syncQueued')),
      onError: () => toast.error(t('deviceDetail.overview.syncFailed')),
    })
  }

  return (
    <header className="space-y-4 border-b border-border/80 pb-5 dark:border-[#242424]">
      <nav
        aria-label={t('deviceDetail.breadcrumbLabel')}
        className="flex flex-wrap items-center gap-x-1 gap-y-2 text-sm text-muted-foreground"
      >
        <Link to="/devices" search={{ platform: device.platform }} className="transition-colors hover:text-foreground">
          {t('nav.devices')}
        </Link>
        <ChevronRight className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="truncate">{title}</span>
      </nav>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3.5">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-border/80 bg-card dark:border-[#242424] dark:bg-[#141414]">
            {isWindows ? (
              <WindowsIcon className="size-6 text-foreground" aria-hidden="true" />
            ) : (
              <AndroidIcon className={cn('size-6', ANDROID_BRAND_COLOR)} aria-hidden="true" />
            )}
          </div>

          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{title}</h1>
              <Badge variant={STATUS_BADGE[onlineStatus] ?? 'secondary'}>
                {t(`devices.status.${onlineStatus}`)}
              </Badge>
              <Badge variant="outline" className="capitalize">
                {device.platform}
              </Badge>
              {managementBadges(device, isWindows, t)}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {model ? (
                <span>
                  {t('deviceDetail.metrics.model')}:{' '}
                  <span className="text-foreground/90">{model}</span>
                </span>
              ) : null}
              <span>
                {t('deviceDetail.metrics.lastOnline')}:{' '}
                <span className="text-foreground/90">{lastSeen}</span>
              </span>
              <span className="inline-flex items-center gap-1 font-mono">
                {t('devices.columns.number')}:{' '}
                <span className="text-foreground/90">{device.number}</span>
                <OverviewCopyButton value={device.number} />
              </span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 self-start">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            disabled={isFetching}
            onClick={onRefresh}
          >
            {isFetching ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}
            {t('deviceDetail.overview.refresh')}
          </Button>

          {!isWindows ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5"
              disabled={syncMutation.isPending}
              onClick={handleSync}
            >
              {syncMutation.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Zap className="size-3.5" />
              )}
              {t('deviceDetail.overview.sync')}
            </Button>
          ) : null}

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button type="button" variant="outline" size="sm" className="h-8 w-8 px-0">
                  <MoreHorizontal className="size-4" />
                  <span className="sr-only">{t('deviceDetail.overview.actionsMenu')}</span>
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onOpenActions}>
                {t('deviceDetail.tabs.actions')}
              </DropdownMenuItem>
              {!isWindows ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSync} disabled={syncMutation.isPending}>
                    {t('deviceDetail.overview.syncConfig')}
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}

export { deviceTitle }
