import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Battery,
  BatteryCharging,
  BatteryLow,
  BatteryMedium,
  Download,
  FileText,
  Lock,
  LockKeyhole,
  LockOpen,
  RefreshCcw,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { TFunction } from 'i18next'
import { toast } from 'sonner'
import {
  OverviewFieldRow,
  OverviewStatusRow,
  OverviewTelemetry,
} from '@/features/devices/components/device-overview/OverviewSection'
import { OverviewCopyButton } from '@/features/devices/components/device-overview/OverviewCopyButton'
import { useDeviceDetailCommandToast } from '@/features/devices/context/device-detail-command-toast-context'
import { usePermissions } from '@/features/auth/hooks/use-permissions'
import { queueWindowsDeviceCommand } from '@/features/windows/api/windows-api'
import {
  formatWindowsUpdateCheck,
} from '@/features/devices/utils/device-detail-formatters'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { DeviceView } from '@/shared/api/types/device'
import type { DeviceDiskVolume, WindowsUpdateItem } from '@/shared/api/types/device-detail'
import { cn } from '@/lib/utils'

const NA = 'N/A'

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

export function CpuOverviewField({ device, na = NA }: { device: DeviceView; na?: string }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const cpuName = device.cpu?.trim() || na
  const cores = device.cpuCores != null && device.cpuCores > 0 ? String(device.cpuCores) : na
  const threads = device.cpuThreads != null && device.cpuThreads > 0 ? String(device.cpuThreads) : na
  const frequency = formatCpuFrequency(device.cpuFrequencyGhz, na)
  const hasDetails = device.cpu?.trim() || device.cpuCores != null

  return (
    <>
      <OverviewFieldRow
        label={t('deviceDetail.metrics.cpu')}
        value={cpuName}
        secondary={
          device.cpuCores != null
            ? t('deviceDetail.cpuDialog.physicalCores') + `: ${cores}`
            : undefined
        }
        action={
          hasDetails ? (
            <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setOpen(true)}>
              {t('deviceDetail.overview.details')}
            </Button>
          ) : undefined
        }
      />
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

function resolveBatteryHeaderIcon(level: number | undefined, status: string | undefined): LucideIcon {
  if (status?.toLowerCase().includes('charging')) {
    return BatteryCharging
  }
  if (level == null) {
    return Battery
  }
  if (level >= 80) {
    return Battery
  }
  if (level >= 40) {
    return BatteryMedium
  }
  if (level >= 20) {
    return Battery
  }
  return BatteryLow
}

export function BatteryOverviewTelemetry({
  device,
  hardwareId,
}: {
  device: DeviceView
  hardwareId?: string
}) {
  const { t } = useTranslation()
  const level = device.batteryLevel ?? device.info?.batteryLevel
  const status = device.batteryStatus?.trim()
  const { canMutate } = usePermissions()
  const { trackActionLogCommand } = useDeviceDetailCommandToast()
  const [isQueueingReport, setIsQueueingReport] = useState(false)
  const HeaderIcon = resolveBatteryHeaderIcon(level, status)
  const isWindows = device.platform === 'windows'

  const handleBatteryReport = () => {
    if (!hardwareId) {
      return
    }
    void (async () => {
      setIsQueueingReport(true)
      try {
        const response = await queueWindowsDeviceCommand(hardwareId, 'battery_report', '{}')
        trackActionLogCommand(hardwareId, response.id)
      } catch {
        toast.error(t('deviceDetail.battery.reportFailed'))
      } finally {
        setIsQueueingReport(false)
      }
    })()
  }

  if (level == null) {
    return (
      <OverviewFieldRow
        label={t('deviceDetail.metrics.battery')}
        value={
          isWindows ? t('deviceDetail.battery.desktopNoBattery') : NA
        }
        action={
          isWindows && canMutate && hardwareId ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs"
              disabled={isQueueingReport}
              onClick={handleBatteryReport}
            >
              <FileText className="size-3" />
              {t('deviceDetail.battery.downloadReport')}
            </Button>
          ) : undefined
        }
      />
    )
  }

  const tone = level <= 20 ? 'warning' : level >= 50 ? 'success' : 'default'

  return (
    <OverviewTelemetry
      label={t('deviceDetail.metrics.battery')}
      valueLabel={`${level}%`}
      percent={level}
      secondary={status}
      tone={tone}
      action={
        <div className="flex items-center gap-1">
          {isWindows && canMutate && hardwareId ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7"
              disabled={isQueueingReport}
              title={t('deviceDetail.battery.downloadReport')}
              onClick={handleBatteryReport}
            >
              <FileText className="size-3.5" />
            </Button>
          ) : null}
          <HeaderIcon className="size-4 text-muted-foreground" />
        </div>
      }
    />
  )
}

export function AntivirusOverviewStatus({ device, na = NA }: { device: DeviceView; na?: string }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const name = device.antivirusName?.trim() || t('deviceDetail.antivirus.unknown')
  const active = device.antivirusActive === true
  const definitionsUpdated = formatWindowsUpdateCheck(device.antivirusDefinitionsUpdated, na)

  return (
    <>
      <OverviewStatusRow
        label={t('deviceDetail.metrics.antivirus')}
        status={active ? 'healthy' : device.antivirusName ? 'critical' : 'neutral'}
        title={name}
        detail={
          <>
            <p>{active ? t('deviceDetail.antivirus.active') : t('deviceDetail.antivirus.inactive')}</p>
            <p className="mt-0.5">
              {t('deviceDetail.antivirusDialog.definitionsUpdated')}: {definitionsUpdated}
            </p>
          </>
        }
        action={
          <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setOpen(true)}>
            {t('deviceDetail.overview.details')}
          </Button>
        }
      />
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
              <dt className="text-muted-foreground">{t('deviceDetail.antivirusDialog.definitionsUpdated')}</dt>
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

export function WindowsUpdateOverviewStatus({
  device,
  hardwareId,
  na = NA,
}: {
  device: DeviceView
  hardwareId: string
  na?: string
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [rollingBackKb, setRollingBackKb] = useState<string | null>(null)
  const [installingKb, setInstallingKb] = useState<string | null>(null)
  const pendingCount = device.pendingUpdates ?? 0
  const lastChecked = formatWindowsUpdateCheck(device.lastUpdateCheck, na)
  const pendingList = device.pendingUpdatesList ?? []
  const installedList = device.installedUpdatesList ?? []
  const { canMutate } = usePermissions()
  const { trackActionLogCommand } = useDeviceDetailCommandToast()

  const handleInstall = async (update: WindowsUpdateItem) => {
    const kb = update.kb?.trim()
    if (!kb) {
      toast.error(t('deviceDetail.windowsUpdateDialog.installMissingKb'))
      return
    }
    setInstallingKb(kb)
    try {
      const response = await queueWindowsDeviceCommand(hardwareId, 'install_windows_update', kb)
      trackActionLogCommand(hardwareId, response.id)
      setOpen(false)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('deviceDetail.windowsUpdateDialog.installFailed'))
    } finally {
      setInstallingKb(null)
    }
  }

  const handleRollback = async (update: WindowsUpdateItem) => {
    const kb = update.kb?.trim()
    if (!kb) {
      toast.error(t('deviceDetail.windowsUpdateDialog.rollbackMissingKb'))
      return
    }
    setRollingBackKb(kb)
    try {
      const response = await queueWindowsDeviceCommand(hardwareId, 'UninstallUpdate', kb)
      trackActionLogCommand(hardwareId, response.id)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('deviceDetail.windowsUpdateDialog.rollbackFailed'))
    } finally {
      setRollingBackKb(null)
    }
  }

  const statusTone =
    pendingCount > 0 ? 'warning' : device.pendingUpdates != null ? 'healthy' : 'neutral'

  return (
    <>
      <OverviewStatusRow
        label={t('deviceDetail.metrics.windowsUpdate')}
        status={statusTone}
        title={
          pendingCount > 0
            ? t('deviceDetail.overview.pendingUpdatesCount', { count: pendingCount })
            : t('deviceDetail.overview.upToDate')
        }
        detail={
          <>
            <p>
              {t('deviceDetail.windowsUpdate.lastChecked')}{' '}
              <span className="text-foreground">{lastChecked}</span>
            </p>
          </>
        }
        action={
          <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => setOpen(true)}>
            <RefreshCcw className="size-3" />
            {t('deviceDetail.overview.manageUpdates')}
          </Button>
        }
      />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('deviceDetail.windowsUpdateDialog.title')}</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="pending">
            <TabsList>
              <TabsTrigger value="pending">{t('deviceDetail.windowsUpdateDialog.pendingTab')}</TabsTrigger>
              <TabsTrigger value="installed">{t('deviceDetail.windowsUpdateDialog.installedTab')}</TabsTrigger>
            </TabsList>
            <TabsContent value="pending" className="mt-4">
              <WindowsUpdateTable
                emptyLabel={t('deviceDetail.windowsUpdateDialog.noPending')}
                installingKb={installingKb}
                na={na}
                onInstall={(update) => void handleInstall(update)}
                rows={pendingList}
                showInstallActions={canMutate}
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
                showActions={canMutate}
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
  showInstallActions = false,
  rollingBackKb = null,
  installingKb = null,
  onRollback,
  onInstall,
}: {
  rows: WindowsUpdateItem[]
  emptyLabel: string
  na: string
  t: TFunction
  showInstalledOn?: boolean
  showActions?: boolean
  showInstallActions?: boolean
  rollingBackKb?: string | null
  installingKb?: string | null
  onRollback?: (update: WindowsUpdateItem) => void
  onInstall?: (update: WindowsUpdateItem) => void
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
              <th className="px-3 py-2 font-medium">{t('deviceDetail.windowsUpdateDialog.columnInstalledOn')}</th>
            ) : null}
            {showActions || showInstallActions ? (
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
                    onClick={() => onRollback?.(row)}
                  >
                    {t('deviceDetail.windowsUpdateDialog.rollback')}
                  </Button>
                </td>
              ) : null}
              {showInstallActions ? (
                <td className="px-3 py-2 align-top">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!row.kb?.trim() || installingKb === row.kb}
                    onClick={() => onInstall?.(row)}
                  >
                    <Download className="mr-1.5 size-3.5" />
                    {t('deviceDetail.windowsUpdateDialog.install')}
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
    on: { Icon: Lock, className: 'text-emerald-600 dark:text-emerald-400' },
    off: { Icon: LockOpen, className: 'text-muted-foreground' },
    unknown: { Icon: LockKeyhole, className: 'text-muted-foreground/50' },
  }[status === 'on' || status === 'off' ? status : 'unknown']
  const { Icon, className } = iconConfig

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span role="img" aria-label={label} className="inline-flex shrink-0 items-center">
            <Icon className={cn('size-3.5', className)} strokeWidth={2.25} />
          </span>
        }
      />
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  )
}

export function DiskOverviewTelemetry({ device, na = NA }: { device: DeviceView; na?: string }) {
  const { t } = useTranslation()
  const disks = device.disks ?? []

  if (disks.length === 0) {
    const diskPercent =
      device.diskTotalGb && device.diskUsedGb != null
        ? Math.round((device.diskUsedGb / device.diskTotalGb) * 100)
        : undefined

    if (diskPercent == null) {
      return <OverviewFieldRow label={t('deviceDetail.metrics.disk')} value={na} />
    }

    const tone = diskPercent >= 90 ? 'warning' : 'default'
    return (
      <OverviewTelemetry
        label={t('deviceDetail.metrics.disk')}
        valueLabel={`${device.diskUsedGb} / ${device.diskTotalGb} GB`}
        percent={diskPercent}
        tone={tone}
      />
    )
  }

  return (
    <div className="space-y-0">
      {disks.map((disk) => {
        const percent = disk.totalGb > 0 ? Math.round((disk.usedGb / disk.totalGb) * 100) : undefined
        const label =
          disks.length === 1
            ? t('deviceDetail.metrics.disk')
            : `${t('deviceDetail.metrics.disk')} · ${disk.mountPoint}`

        if (percent == null) {
          return (
            <OverviewFieldRow
              key={disk.mountPoint}
              label={label}
              value={na}
              secondary={
                <span className="inline-flex items-center gap-1.5">
                  <DriveEncryptionIcon status={disk.encryptStatus} t={t} />
                  {disk.label ?? disk.mountPoint}
                </span>
              }
            />
          )
        }

        return (
          <OverviewTelemetry
            key={disk.mountPoint}
            label={label}
            valueLabel={`${disk.usedGb} / ${disk.totalGb} GB`}
            percent={percent}
            tone={percent >= 90 ? 'warning' : 'default'}
            secondary={
              <span className="inline-flex items-center gap-1.5">
                <DriveEncryptionIcon status={disk.encryptStatus} t={t} />
                {disk.label ? `${disk.mountPoint} · ${disk.label}` : disk.mountPoint}
              </span>
            }
          />
        )
      })}
    </div>
  )
}

export function NetworkOverviewFields({ device, na = NA }: { device: DeviceView; na?: string }) {
  const { t } = useTranslation()
  const localIp = device.localIp?.trim() || na
  const publicIp = device.publicIp?.trim() || na

  return (
    <>
      <OverviewFieldRow
        label={t('deviceDetail.network.localIpLabel')}
        value={localIp}
        mono
        action={localIp !== na ? <OverviewCopyButton value={localIp} /> : undefined}
      />
      <OverviewFieldRow
        label={t('deviceDetail.network.publicIpLabel')}
        value={publicIp}
        mono
        action={publicIp !== na ? <OverviewCopyButton value={publicIp} /> : undefined}
      />
    </>
  )
}

export function BitLockerOverviewStatus({ device, t }: { device: DeviceView; t: TFunction }) {
  const status = device.bitlockerStatus ?? 'unknown'
  const statusMap = {
    on: { tone: 'healthy' as const, label: t('deviceDetail.bitlocker.status.on') },
    off: { tone: 'warning' as const, label: t('deviceDetail.bitlocker.status.off') },
    unknown: { tone: 'neutral' as const, label: t('deviceDetail.bitlocker.status.unknown') },
  }
  const mapped = statusMap[status === 'on' || status === 'off' ? status : 'unknown']

  return (
    <OverviewStatusRow
      label={t('deviceDetail.metrics.encryption')}
      status={mapped.tone}
      title={mapped.label}
    />
  )
}
