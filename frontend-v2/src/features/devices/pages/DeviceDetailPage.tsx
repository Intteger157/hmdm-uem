import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import {
  Activity,
  AppWindow,
  ArrowLeft,
  Barcode,
  ChevronRight,
  Clock,
  Cpu,
  Globe,
  HardDrive,
  Hash,
  Key,
  Layers,
  Lock,
  LockKeyhole,
  LockOpen,
  MemoryStick,
  Monitor,
  RefreshCcw,
  Shield,
  ShieldOff,
  User,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { DeviceActionsPanel } from '@/features/devices/components/DeviceActionsPanel'
import { WindowsDeviceServicesTab } from '@/features/devices/components/WindowsDeviceServicesTab'
import { WindowsDeviceActionLogsTab } from '@/features/devices/components/WindowsDeviceActionLogsTab'
import { useDeviceByNumber } from '@/features/devices/hooks/use-device-by-number-query'
import {
  formatDeviceEnrollTime,
  formatDeviceTimestamp,
  formatUptime,
  formatWindowsCurrentUser,
  formatWindowsUpdateCheck,
  resolveEnrollTime,
  resolveLauncherVersion,
  resolvePublicIp,
} from '@/features/devices/utils/device-detail-formatters'
import { resolveDeviceOnlineStatusCode } from '@/features/devices/utils/device-online-status'
import { usePeriodicNow } from '@/shared/hooks/use-periodic-now'
import { ANDROID_BRAND_COLOR, AndroidIcon, BatteryLevelIcon } from '@/components/icons/platform-icons'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Progress, ProgressLabel, ProgressValue } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { Platform } from '@/shared/api/types/platform'
import type { DeviceView } from '@/shared/api/types/device'
import type { DeviceDiskVolume, WindowsUpdateItem } from '@/shared/api/types/device-detail'
import type { TFunction } from 'i18next'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { queueWindowsDeviceCommand } from '@/features/windows/api/windows-api'
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
const TILE_HEADER_ICON_CLASS = 'size-5 text-muted-foreground/70'
const INTERACTIVE_TILE_CLASS = 'cursor-pointer hover:bg-accent/50 transition-colors'

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

      {device.platform === 'windows' ? (
        <WindowsOverviewGrid device={device} na={NA} t={t} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
          <MetricCard
            label={t('devices.columns.number')}
            value={device.number}
            mono
            headerIcon={Hash}
          />
          <MetricCard
            label={t('deviceDetail.metrics.model')}
            value={device.model ?? device.manufacturer ?? device.info?.model ?? NA}
            headerIcon={Layers}
          />
          <MetricCard
            label={t('deviceDetail.metrics.lastOnline')}
            value={formatDeviceTimestamp(device.lastUpdate)}
            headerIcon={Clock}
          />
          <MetricCard
            label={t('deviceDetail.metrics.serial')}
            value={device.serialNumber ?? device.serial ?? device.info?.serial ?? NA}
            mono
            headerIcon={Barcode}
          />
          <MetricCard label={t('devices.columns.imei')} value={device.imei ?? device.info?.imei ?? NA} mono />
          <MetricCard
            label={t('devices.columns.androidVersion')}
            value={androidVersion ?? NA}
            headerIcon={Monitor}
            leadingIcon={
              androidVersion ? (
                <AndroidIcon className={cn(METRIC_ICON_CLASS, ANDROID_BRAND_COLOR)} />
              ) : undefined
            }
          />
          <MetricCard
            label={t('devices.columns.battery')}
            value={batteryLevel != null ? `${batteryLevel}%` : NA}
            leadingIcon={
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
              enrollTime != null ? formatDeviceEnrollTime(enrollTime) : t('devices.date.unknown')
            }
          />
          <MetricCard label={t('deviceDetail.metrics.publicIp')} value={publicIp ?? NA} mono />
        </div>
      )}

      <Tabs value={tabValue} onValueChange={setActiveTab}>
        <TabsList variant="line">
          <TabsTrigger value="software">{t('deviceDetail.tabs.software')}</TabsTrigger>
          {showLocalUsers ? (
            <TabsTrigger value="users">{t('deviceDetail.tabs.users')}</TabsTrigger>
          ) : null}
          {device.platform === 'windows' ? (
            <TabsTrigger value="services">{t('deviceDetail.tabs.services')}</TabsTrigger>
          ) : null}
          {device.platform === 'windows' ? (
            <TabsTrigger value="logs">{t('deviceDetail.tabs.actionLogs')}</TabsTrigger>
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

        {device.platform === 'windows' ? (
          <TabsContent value="services" className="mt-4">
            <WindowsDeviceServicesTab hardwareId={device.number} />
          </TabsContent>
        ) : null}

        {device.platform === 'windows' ? (
          <TabsContent value="logs" className="mt-4">
            <WindowsDeviceActionLogsTab hardwareId={device.number} />
          </TabsContent>
        ) : null}

        <TabsContent value="actions" className="mt-4">
          <DeviceActionsPanel device={device} platform={device.platform} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function WindowsOverviewGrid({
  device,
  na,
  t,
}: {
  device: DeviceView
  na: string
  t: TFunction
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        className="h-full"
        label={t('devices.columns.hostname')}
        value={device.hostname ?? NA}
        mono
        headerIcon={Monitor}
      />
      <MetricCard
        className="h-full"
        label={t('deviceDetail.metrics.model')}
        value={device.model ?? device.manufacturer ?? NA}
        headerIcon={Layers}
        valueClassName="text-lg"
      />
      <MetricCard
        className="h-full"
        label={t('devices.columns.number')}
        value={device.number}
        mono
        headerIcon={Hash}
      />
      <MetricCard
        className="h-full"
        label={t('deviceDetail.metrics.serial')}
        value={device.serialNumber ?? device.serial ?? NA}
        mono
        headerIcon={Barcode}
      />
      <MetricCard
        className="h-full"
        label={t('devices.columns.windowsBuild')}
        value={device.windowsBuild ?? NA}
        headerIcon={AppWindow}
        valueClassName="text-lg"
      />
      <MetricCard
        className="h-full"
        label={t('deviceDetail.metrics.uptime')}
        value={formatUptime(device.uptimeSeconds)}
        headerIcon={Activity}
        valueClassName="text-lg"
      />
      <NetworkMetricCard className="h-full" device={device} na={na} t={t} />
      <MetricCard
        className="h-full"
        label={t('deviceDetail.metrics.currentUser')}
        value={formatWindowsCurrentUser(device.currentUser, na, device.localUsers)}
        mono
        headerIcon={User}
        valueClassName="text-lg"
      />
      <CpuMetricCard className="h-full" device={device} na={na} t={t} />
      <MetricCard
        className="h-full"
        label={t('deviceDetail.metrics.ram')}
        value={device.ramGb != null ? `${device.ramGb} GB` : NA}
        headerIcon={MemoryStick}
      />
      <AntivirusMetricCard className="h-full" device={device} na={na} t={t} />
      <WindowsUpdateMetricCard className="h-full" device={device} hardwareId={device.number} na={na} t={t} />
      <WindowsDiskMetrics className="h-full lg:col-span-4" device={device} na={na} t={t} />
    </div>
  )
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

function formatCpuFrequency(ghz: number | undefined, na: string): string {
  if (ghz == null || !Number.isFinite(ghz) || ghz <= 0) {
    return na
  }
  return `${ghz.toFixed(2)} GHz`
}

function CpuMetricCard({
  device,
  na,
  t,
  className,
}: {
  device: DeviceView
  na: string
  t: TFunction
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const cpuName = device.cpu?.trim() || na
  const cores =
    device.cpuCores != null && device.cpuCores > 0 ? String(device.cpuCores) : na
  const threads =
    device.cpuThreads != null && device.cpuThreads > 0 ? String(device.cpuThreads) : na
  const frequency = formatCpuFrequency(device.cpuFrequencyGhz, na)

  return (
    <>
      <Card
        className={cn('h-full', INTERACTIVE_TILE_CLASS, className)}
        onClick={() => setOpen(true)}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            setOpen(true)
          }
        }}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 px-4 pb-2 pt-4">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {t('deviceDetail.metrics.cpu')}
          </CardTitle>
          <Cpu className={TILE_HEADER_ICON_CLASS} />
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <p className="line-clamp-2 text-lg font-bold leading-tight">{cpuName}</p>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('deviceDetail.cpuDialog.title')}</DialogTitle>
          </DialogHeader>
          <dl className="space-y-3 text-sm">
            <div className="flex flex-col gap-1">
              <dt className="text-muted-foreground">{t('deviceDetail.cpuDialog.name')}</dt>
              <dd className="font-medium">{cpuName}</dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-muted-foreground">{t('deviceDetail.cpuDialog.physicalCores')}</dt>
              <dd className="font-medium">{cores}</dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-muted-foreground">{t('deviceDetail.cpuDialog.logicalProcessors')}</dt>
              <dd className="font-medium">{threads}</dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-muted-foreground">{t('deviceDetail.cpuDialog.frequency')}</dt>
              <dd className="font-medium">{frequency}</dd>
            </div>
          </dl>
        </DialogContent>
      </Dialog>
    </>
  )
}

function AntivirusMetricCard({
  device,
  na,
  t,
  className,
}: {
  device: DeviceView
  na: string
  t: TFunction
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const name = device.antivirusName?.trim() || t('deviceDetail.antivirus.unknown')
  const active = device.antivirusActive === true
  const StatusIcon = active ? Shield : ShieldOff
  const definitionsUpdated = formatWindowsUpdateCheck(device.antivirusDefinitionsUpdated, na)

  return (
    <>
      <Card
        className={cn('h-full', INTERACTIVE_TILE_CLASS, className)}
        onClick={() => setOpen(true)}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            setOpen(true)
          }
        }}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 px-4 pb-2 pt-4">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {t('deviceDetail.metrics.antivirus')}
          </CardTitle>
          <Shield className={TILE_HEADER_ICON_CLASS} />
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="flex items-start gap-3">
            <StatusIcon
              className={cn(
                'mt-0.5 size-5 shrink-0',
                active ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive',
              )}
              strokeWidth={2.25}
            />
            <div className="min-w-0">
              <p className="truncate text-xl font-bold leading-tight">{name}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {active ? t('deviceDetail.antivirus.active') : t('deviceDetail.antivirus.inactive')}
              </p>
            </div>
          </div>
          {!device.antivirusName ? <span className="sr-only">{na}</span> : null}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('deviceDetail.antivirusDialog.title')}</DialogTitle>
          </DialogHeader>
          <dl className="space-y-3 text-sm">
            <div className="flex flex-col gap-1">
              <dt className="text-muted-foreground">{t('deviceDetail.antivirusDialog.product')}</dt>
              <dd className="font-medium">{name}</dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-muted-foreground">{t('deviceDetail.antivirusDialog.status')}</dt>
              <dd className="font-medium">
                {active ? t('deviceDetail.antivirus.active') : t('deviceDetail.antivirus.inactive')}
              </dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-muted-foreground">
                {t('deviceDetail.antivirusDialog.definitionsUpdated')}
              </dt>
              <dd className="font-medium">{definitionsUpdated}</dd>
            </div>
          </dl>
          <div className="space-y-2">
            <h4 className="text-sm font-medium">{t('deviceDetail.antivirusDialog.historyTitle')}</h4>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left">
                    <th className="px-3 py-2 font-medium">{t('deviceDetail.antivirusDialog.historyEvent')}</th>
                    <th className="px-3 py-2 font-medium">{t('deviceDetail.antivirusDialog.historyDate')}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="px-3 py-3 text-muted-foreground" colSpan={2}>
                      {t('deviceDetail.antivirusDialog.historyPlaceholder')}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function NetworkMetricCard({
  device,
  na,
  t,
  className,
}: {
  device: DeviceView
  na: string
  t: TFunction
  className?: string
}) {
  const localIp = device.localIp?.trim() || na
  const publicIp = device.publicIp?.trim() || na

  return (
    <Card className={cn('h-full', className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 px-4 pb-2 pt-4">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {t('deviceDetail.metrics.network')}
        </CardTitle>
        <Globe className={TILE_HEADER_ICON_CLASS} />
      </CardHeader>
      <CardContent className="space-y-2 px-4 pb-4">
        <p className="text-sm text-muted-foreground">
          {t('deviceDetail.network.localIp')}{' '}
          <span className="font-mono text-base font-bold text-foreground">{localIp}</span>
        </p>
        <p className="text-sm text-muted-foreground">
          {t('deviceDetail.network.publicIp')}{' '}
          <span className="font-mono text-base font-bold text-foreground">{publicIp}</span>
        </p>
      </CardContent>
    </Card>
  )
}

function WindowsUpdateMetricCard({
  device,
  hardwareId,
  na,
  t,
  className,
}: {
  device: DeviceView
  hardwareId: string
  na: string
  t: TFunction
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [rollingBackKb, setRollingBackKb] = useState<string | null>(null)
  const pending = device.pendingUpdates != null ? String(device.pendingUpdates) : na
  const lastChecked = formatWindowsUpdateCheck(device.lastUpdateCheck, na)
  const pendingList = device.pendingUpdatesList ?? []
  const installedList = device.installedUpdatesList ?? []

  const handleRollback = async (update: WindowsUpdateItem) => {
    const kb = update.kb?.trim()
    if (!kb) {
      toast.error(t('deviceDetail.windowsUpdateDialog.rollbackMissingKb'))
      return
    }

    setRollingBackKb(kb)
    try {
      await queueWindowsDeviceCommand(hardwareId, 'UninstallUpdate', kb)
      toast.success(t('deviceDetail.windowsUpdateDialog.rollbackQueued'))
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('deviceDetail.windowsUpdateDialog.rollbackFailed'))
    } finally {
      setRollingBackKb(null)
    }
  }

  return (
    <>
      <Card
        className={cn('h-full', INTERACTIVE_TILE_CLASS, className)}
        onClick={() => setOpen(true)}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            setOpen(true)
          }
        }}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 px-4 pb-2 pt-4">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {t('deviceDetail.metrics.windowsUpdate')}
          </CardTitle>
          <RefreshCcw className={TILE_HEADER_ICON_CLASS} />
        </CardHeader>
        <CardContent className="space-y-2 px-4 pb-4">
          <p className="text-sm text-muted-foreground">
            {t('deviceDetail.windowsUpdate.pending')}{' '}
            <span className="text-base font-bold text-foreground">{pending}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            {t('deviceDetail.windowsUpdate.lastChecked')}{' '}
            <span className="text-base font-bold text-foreground">{lastChecked}</span>
          </p>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('deviceDetail.windowsUpdateDialog.title')}</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="pending">
            <TabsList>
              <TabsTrigger value="pending">
                {t('deviceDetail.windowsUpdateDialog.pendingTab')}
              </TabsTrigger>
              <TabsTrigger value="installed">
                {t('deviceDetail.windowsUpdateDialog.installedTab')}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="pending" className="mt-4">
              <WindowsUpdateTable
                emptyLabel={t('deviceDetail.windowsUpdateDialog.noPending')}
                na={na}
                rows={pendingList}
                showInstalledOn={false}
                t={t}
              />
            </TabsContent>
            <TabsContent value="installed" className="mt-4">
              <WindowsUpdateTable
                emptyLabel={t('deviceDetail.windowsUpdateDialog.noInstalled')}
                na={na}
                onRollback={(update) => void handleRollback(update)}
                rollingBackKb={rollingBackKb}
                rows={installedList}
                showActions
                showInstalledOn
                t={t}
              />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  )
}

function WindowsUpdateTable({
  rows,
  emptyLabel,
  na,
  t,
  showInstalledOn = false,
  showActions = false,
  rollingBackKb = null,
  onRollback,
}: {
  rows: WindowsUpdateItem[]
  emptyLabel: string
  na: string
  t: TFunction
  showInstalledOn?: boolean
  showActions?: boolean
  rollingBackKb?: string | null
  onRollback?: (update: WindowsUpdateItem) => void
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>
  }

  return (
    <div className="max-h-80 overflow-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
          <tr className="border-b text-left">
            <th className="px-3 py-2 font-medium">{t('deviceDetail.windowsUpdateDialog.columnTitle')}</th>
            <th className="px-3 py-2 font-medium">{t('deviceDetail.windowsUpdateDialog.columnKb')}</th>
            {showInstalledOn ? (
              <th className="px-3 py-2 font-medium">
                {t('deviceDetail.windowsUpdateDialog.columnInstalledOn')}
              </th>
            ) : null}
            {showActions ? (
              <th className="px-3 py-2 font-medium">{t('deviceDetail.windowsUpdateDialog.columnActions')}</th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row.kb ?? row.title}-${index}`} className="border-b last:border-b-0">
              <td className="px-3 py-2 align-top">{row.title || na}</td>
              <td className="px-3 py-2 align-top font-mono">{row.kb || na}</td>
              {showInstalledOn ? (
                <td className="px-3 py-2 align-top whitespace-nowrap">
                  {formatWindowsUpdateCheck(row.installedOn, na)}
                </td>
              ) : null}
              {showActions ? (
                <td className="px-3 py-2 align-top">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!row.kb?.trim() || rollingBackKb === row.kb}
                    onClick={(event) => {
                      event.stopPropagation()
                      onRollback?.(row)
                    }}
                  >
                    {t('deviceDetail.windowsUpdateDialog.rollback')}
                  </Button>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DriveEncryptionIcon({
  status,
  t,
}: {
  status: DeviceDiskVolume['encryptStatus']
  t: TFunction
}) {
  const label = formatDriveEncryptStatus(status, t)

  const iconConfig = {
    on: {
      Icon: Lock,
      className: 'text-emerald-600 dark:text-emerald-400',
    },
    off: {
      Icon: LockOpen,
      className: 'text-muted-foreground',
    },
    unknown: {
      Icon: LockKeyhole,
      className: 'text-muted-foreground/50',
    },
  }[status === 'on' || status === 'off' ? status : 'unknown']

  const { Icon, className } = iconConfig

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            role="img"
            aria-label={label}
            className="inline-flex shrink-0 items-center"
          >
            <Icon className={cn('size-3.5', className)} strokeWidth={2.25} />
          </span>
        }
      />
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  )
}

function WindowsDiskMetrics({
  device,
  na,
  t,
  className,
}: {
  device: DeviceView
  na: string
  t: TFunction
  className?: string
}) {
  const disks = device.disks ?? []

  if (disks.length === 0) {
    const diskPercent =
      device.diskTotalGb && device.diskUsedGb != null
        ? Math.round((device.diskUsedGb / device.diskTotalGb) * 100)
        : undefined

    return (
      <Card className={cn('h-full md:col-span-2', className)}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 px-4 pb-2 pt-4">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {t('deviceDetail.metrics.disk')}
          </CardTitle>
          <HardDrive className={TILE_HEADER_ICON_CLASS} />
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {diskPercent != null ? (
            <Progress value={diskPercent}>
              <ProgressLabel className="text-xs">
                {device.diskUsedGb} / {device.diskTotalGb} GB
              </ProgressLabel>
              <ProgressValue />
            </Progress>
          ) : (
            <span className="text-xl font-bold">{na}</span>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn('h-full', className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 px-4 pb-2 pt-4">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {t('deviceDetail.metrics.disks')}
        </CardTitle>
        <HardDrive className={TILE_HEADER_ICON_CLASS} />
      </CardHeader>
      <CardContent className="space-y-3 px-4 pb-4">
        {disks.map((disk) => {
          const percent =
            disk.totalGb > 0 ? Math.round((disk.usedGb / disk.totalGb) * 100) : undefined
          const showBitLockerKey =
            disk.mountPoint === 'C:' && device.bitLockerKey?.trim()

          return (
            <div key={disk.mountPoint} className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs">
                <span className="inline-flex items-center gap-1 font-medium">
                  {disk.mountPoint}
                  <DriveEncryptionIcon status={disk.encryptStatus} t={t} />
                </span>
                {disk.label ? (
                  <span className="truncate text-muted-foreground">· {disk.label}</span>
                ) : null}
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
              {showBitLockerKey ? (
                <div className="flex items-start gap-1.5 pt-0.5">
                  <Key className="mt-0.5 size-3.5 shrink-0 text-muted-foreground opacity-50" />
                  <p className="font-mono text-xs leading-relaxed text-muted-foreground">
                    {device.bitLockerKey}
                  </p>
                </div>
              ) : null}
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
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i} className="h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 px-4 pb-2 pt-4">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-4 rounded-full" />
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <Skeleton className="h-7 w-28" />
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
  headerIcon: HeaderIcon,
  leadingIcon,
  className,
  valueClassName,
}: {
  label: string
  value: string
  mono?: boolean
  headerIcon?: LucideIcon
  leadingIcon?: ReactNode
  className?: string
  valueClassName?: string
}) {
  return (
    <Card className={cn('h-full', className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 px-4 pb-2 pt-4">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        {HeaderIcon ? <HeaderIcon className={TILE_HEADER_ICON_CLASS} /> : null}
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="flex items-center gap-3">
          {leadingIcon ? <span className="inline-flex shrink-0 items-center">{leadingIcon}</span> : null}
          <p
            className={cn(
              'text-xl font-bold leading-tight',
              mono && 'font-mono text-lg',
              valueClassName,
            )}
          >
            {value}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
