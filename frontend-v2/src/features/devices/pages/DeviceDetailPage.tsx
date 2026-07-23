import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, ChevronRight } from 'lucide-react'
import { DeviceActionsPanel } from '@/features/devices/components/DeviceActionsPanel'
import { useDeviceByNumber } from '@/features/devices/hooks/use-device-by-number-query'
import {
  formatDeviceEnrollTime,
  formatDeviceTimestamp,
  formatWindowsCurrentUser,
  resolveEnrollTime,
  resolveLauncherVersion,
  resolvePublicIp,
} from '@/features/devices/utils/device-detail-formatters'
import { resolveDeviceOnlineStatusCode } from '@/features/devices/utils/device-online-status'
import { usePeriodicNow } from '@/shared/hooks/use-periodic-now'
import { ANDROID_BRAND_COLOR, AndroidIcon, BatteryLevelIcon } from '@/components/icons/platform-icons'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress, ProgressLabel, ProgressValue } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { Platform } from '@/shared/api/types/platform'
import type { DeviceView } from '@/shared/api/types/device'
import type { DeviceDiskVolume } from '@/shared/api/types/device-detail'
import type { TFunction } from 'i18next'
import { cn } from '@/lib/utils'
import { useState, type ReactNode } from 'react'

const STATUS_BADGE: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  green: 'default',
  yellow: 'outline',
  red: 'destructive',
  brown: 'secondary',
  grey: 'secondary',
}

const NA = 'N/A'
const METRIC_ICON_CLASS = 'size-8'

function deviceTitle(device: DeviceView): string {
  if (device.platform === 'windows') {
    return device.hostname ?? device.model ?? device.number
  }
  return device.description ?? device.hostname ?? device.number
}

function deviceIdentifier(device: DeviceView): string {
  return device.platform === 'windows'
    ? (device.hostname ?? device.number)
    : device.number
}

interface DeviceDetailPageProps {
  deviceNumber: string
  platform?: Platform
}

export function DeviceDetailPage({ deviceNumber, platform = 'android' }: DeviceDetailPageProps) {
  const { t } = useTranslation()
  const now = usePeriodicNow()
  const { data: device, isLoading, error } = useDeviceByNumber(deviceNumber, platform)
  const [activeTab, setActiveTab] = useState('software')

  if (isLoading) {
    return <DeviceDetailSkeleton />
  }

  if (error || !device) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('deviceDetail.notFound')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Link
            to="/devices"
            search={{ platform }}
            className={buttonVariants({ variant: 'outline' })}
          >
            <ArrowLeft className="mr-2 size-4" />
            {t('deviceDetail.backToList')}
          </Link>
        </CardContent>
      </Card>
    )
  }

  const androidVersion = device.androidVersion ?? device.info?.androidVersion
  const batteryLevel = device.info?.batteryLevel
  const launcherVersion = resolveLauncherVersion(device)
  const enrollTime = resolveEnrollTime(device)
  const publicIp = resolvePublicIp(device)
  const onlineStatus = resolveDeviceOnlineStatusCode(device, now)
  const showLocalUsers = device.platform === 'windows'
  const tabValue = !showLocalUsers && activeTab === 'users' ? 'software' : activeTab
  const title = deviceTitle(device)
  const identifier = deviceIdentifier(device)
  const showIdentifierSubtitle = identifier !== title

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link to="/devices" search={{ platform: device.platform }} className="hover:text-foreground">
          {t('nav.devices')}
        </Link>
        <ChevronRight className="size-3.5" />
        <span className="text-foreground">{deviceIdentifier(device)}</span>
      </div>

      <div className="flex flex-col gap-4 border-b pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
            <Badge variant={STATUS_BADGE[onlineStatus] ?? 'secondary'}>
              {t(`devices.status.${onlineStatus}`)}
            </Badge>
            <Badge variant="outline">{device.platform}</Badge>
            {device.kioskMode && <Badge variant="secondary">Kiosk</Badge>}
            {device.mdmMode && <Badge variant="secondary">MDM</Badge>}
          </div>
          {showIdentifierSubtitle ? (
            <p className="font-mono text-sm text-muted-foreground">{identifier}</p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        <MetricCard label={t('devices.columns.number')} value={device.number} mono />
        <MetricCard
          label={t('deviceDetail.metrics.model')}
          value={device.model ?? device.manufacturer ?? device.info?.model ?? NA}
        />
        <MetricCard label={t('deviceDetail.metrics.lastOnline')} value={formatDeviceTimestamp(device.lastUpdate)} />
        <MetricCard
          label={t('deviceDetail.metrics.serial')}
          value={device.serialNumber ?? device.serial ?? device.info?.serial ?? NA}
          mono
        />
        {device.platform !== 'windows' && (
          <MetricCard label={t('devices.columns.imei')} value={device.imei ?? device.info?.imei ?? NA} mono />
        )}

        {device.platform === 'windows' && (
          <>
            <MetricCard label={t('devices.columns.hostname')} value={device.hostname ?? NA} mono />
            <MetricCard
              label={t('devices.columns.windowsBuild')}
              value={device.windowsBuild ?? NA}
            />
            <MetricCard label={t('deviceDetail.metrics.cpu')} value={device.cpu ?? NA} />
            <MetricCard
              label={t('deviceDetail.metrics.ram')}
              value={device.ramGb != null ? `${device.ramGb} GB` : NA}
            />
            <WindowsDiskMetrics device={device} na={NA} t={t} />
            <MetricCard
              label={t('deviceDetail.metrics.encryption')}
              value={resolveEncryptionLabel(device, t)}
            />
            <MetricCard
              label={t('deviceDetail.metrics.currentUser')}
              value={formatWindowsCurrentUser(device.currentUser, NA, device.localUsers)}
              mono
            />
          </>
        )}

        {device.platform === 'android' && (
          <>
            <MetricCard
              label={t('devices.columns.androidVersion')}
              value={androidVersion ?? NA}
              icon={
                androidVersion ? (
                  <AndroidIcon className={cn(METRIC_ICON_CLASS, ANDROID_BRAND_COLOR)} />
                ) : undefined
              }
            />
            <MetricCard
              label={t('devices.columns.battery')}
              value={batteryLevel != null ? `${batteryLevel}%` : NA}
              icon={
                batteryLevel != null ? (
                  <BatteryLevelIcon level={batteryLevel} className={METRIC_ICON_CLASS} />
                ) : undefined
              }
            />
            <MetricCard
              label={t('devices.columns.launcherVersion')}
              value={launcherVersion ?? NA}
            />
            <MetricCard
              label={t('deviceDetail.metrics.enrolled')}
              value={
                enrollTime != null
                  ? formatDeviceEnrollTime(enrollTime)
                  : t('devices.date.unknown')
              }
            />
            <MetricCard label={t('deviceDetail.metrics.publicIp')} value={publicIp ?? NA} mono />
          </>
        )}
      </div>

      <Tabs value={tabValue} onValueChange={setActiveTab}>
        <TabsList variant="line">
          <TabsTrigger value="software">{t('deviceDetail.tabs.software')}</TabsTrigger>
          {showLocalUsers ? (
            <TabsTrigger value="users">{t('deviceDetail.tabs.users')}</TabsTrigger>
          ) : null}
          <TabsTrigger value="actions">{t('deviceDetail.tabs.actions')}</TabsTrigger>
        </TabsList>

        <TabsContent value="software" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="max-h-80 overflow-auto">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 border-b bg-muted/80 backdrop-blur">
                    <tr className="text-muted-foreground">
                      <th className="px-4 py-2.5 font-medium">{t('deviceDetail.software.name')}</th>
                      <th className="px-4 py-2.5 font-medium">{t('deviceDetail.software.version')}</th>
                      <th className="px-4 py-2.5 font-medium">{t('deviceDetail.software.publisher')}</th>
                      <th className="px-4 py-2.5 font-medium">{t('deviceDetail.software.installed')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(device.installedSoftware ?? []).map((app) => (
                      <tr key={`${app.name}-${app.version}`} className="border-b last:border-0">
                        <td className="px-4 py-2.5 font-medium">{app.name}</td>
                        <td className="px-4 py-2.5 font-mono text-xs">{app.version}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{app.publisher}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap">{app.installDate}</td>
                      </tr>
                    ))}
                    {(device.installedSoftware ?? []).length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                          {t('deviceDetail.software.empty')}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {showLocalUsers ? (
          <TabsContent value="users" className="mt-4">
            <Card>
              <CardContent className="p-0">
                <table className="w-full text-left text-sm">
                  <thead className="border-b bg-muted/40 text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">{t('deviceDetail.users.username')}</th>
                      <th className="px-4 py-2.5 font-medium">{t('deviceDetail.users.admin')}</th>
                      <th className="px-4 py-2.5 font-medium">{t('deviceDetail.users.status')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(device.localUsers ?? []).map((user) => (
                      <tr key={user.username} className="border-b last:border-0">
                        <td className="px-4 py-2.5 font-mono text-xs">{user.username}</td>
                        <td className="px-4 py-2.5">
                          {user.isAdmin ? t('deviceDetail.users.yes') : t('deviceDetail.users.no')}
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge
                            variant={
                              user.status === 'active'
                                ? 'default'
                                : user.status === 'locked'
                                  ? 'destructive'
                                  : 'secondary'
                            }
                          >
                            {user.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                    {(device.localUsers ?? []).length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">
                          {t('deviceDetail.users.empty')}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>
        ) : null}

        <TabsContent value="actions" className="mt-4">
          <DeviceActionsPanel device={device} platform={device.platform} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function resolveEncryptionLabel(device: DeviceView, t: TFunction): string {
  switch (device.encryptionStatus) {
    case 'all':
      return t('deviceDetail.encrypted')
    case 'partial':
      return t('deviceDetail.partiallyEncrypted')
    case 'none':
      return t('deviceDetail.notEncrypted')
    case 'unknown':
      return t('deviceDetail.encryptionUnknown')
    default:
      break
  }
  if (device.diskEncrypted === true) {
    return t('deviceDetail.encrypted')
  }
  if (device.diskEncrypted === false) {
    return t('deviceDetail.notEncrypted')
  }
  return t('deviceDetail.encryptionUnknown')
}

function formatDriveEncryptStatus(status: DeviceDiskVolume['encryptStatus'], t: TFunction): string {
  switch (status) {
    case 'on':
      return t('deviceDetail.encrypted')
    case 'off':
      return t('deviceDetail.notEncrypted')
    default:
      return t('deviceDetail.encryptionUnknown')
  }
}

function WindowsDiskMetrics({
  device,
  na,
  t,
}: {
  device: DeviceView
  na: string
  t: TFunction
}) {
  const disks = device.disks ?? []

  if (disks.length === 0) {
    const diskPercent =
      device.diskTotalGb && device.diskUsedGb != null
        ? Math.round((device.diskUsedGb / device.diskTotalGb) * 100)
        : undefined

    return (
      <Card className="sm:col-span-2">
        <CardHeader className="px-4 py-3 pb-1">
          <CardTitle className="text-xs font-medium text-muted-foreground">
            {t('deviceDetail.metrics.disk')}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3 pt-0">
          {diskPercent != null ? (
            <Progress value={diskPercent}>
              <ProgressLabel className="text-xs">
                {device.diskUsedGb} / {device.diskTotalGb} GB
              </ProgressLabel>
              <ProgressValue />
            </Progress>
          ) : (
            <span className="text-sm">{na}</span>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="sm:col-span-2 lg:col-span-3">
      <CardHeader className="px-4 py-3 pb-1">
        <CardTitle className="text-xs font-medium text-muted-foreground">
          {t('deviceDetail.metrics.disks')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 px-4 pb-3 pt-0">
        {disks.map((disk) => {
          const percent =
            disk.totalGb > 0 ? Math.round((disk.usedGb / disk.totalGb) * 100) : undefined
          const title = disk.label
            ? `${disk.mountPoint} · ${disk.label}`
            : disk.mountPoint

          return (
            <div key={disk.mountPoint} className="space-y-1.5">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="font-medium">{title}</span>
                <span className="text-muted-foreground">
                  {formatDriveEncryptStatus(disk.encryptStatus, t)}
                </span>
              </div>
              {percent != null ? (
                <Progress value={percent}>
                  <ProgressLabel className="text-xs">
                    {disk.usedGb} / {disk.totalGb} GB
                  </ProgressLabel>
                  <ProgressValue />
                </Progress>
              ) : (
                <span className="text-sm">{na}</span>
              )}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

function DeviceDetailSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-4 w-48" />
      <div className="space-y-2 border-b pb-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="px-4 py-3 pb-1">
              <Skeleton className="h-3 w-20" />
            </CardHeader>
            <CardContent className="px-4 pb-3 pt-0">
              <Skeleton className="h-5 w-28" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Skeleton className="h-10 w-full max-w-md" />
      <Skeleton className="h-64 w-full" />
    </div>
  )
}

function MetricCard({
  label,
  value,
  mono,
  icon,
}: {
  label: string
  value: string
  mono?: boolean
  icon?: ReactNode
}) {
  return (
    <Card>
      <CardHeader className="px-4 py-3 pb-1">
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent
        className={cn(
          'px-4 pb-3 pt-0 font-medium',
          icon ? 'text-base' : 'text-sm',
          mono && 'font-mono text-xs',
        )}
      >
        <div className="flex items-center gap-3 leading-none">
          {icon ? <span className="inline-flex shrink-0 items-center">{icon}</span> : null}
          <span className="leading-snug">{value}</span>
        </div>
      </CardContent>
    </Card>
  )
}
