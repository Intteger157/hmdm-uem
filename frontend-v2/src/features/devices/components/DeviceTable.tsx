import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { Pencil, QrCode, Trash2 } from 'lucide-react'
import {
  getConfigurationName,
  getConfigurationQrCodeKey,
} from '@/features/devices/api/devices-api'
import {
  DeviceActionsMenu,
  type DeviceActionsMenuAction,
} from '@/features/devices/components/DeviceActionsMenu'
import {
  getDeviceFilesIndicator,
  getDeviceInstallIndicator,
  getDevicePermissionIndicator,
  resolveDeviceConfiguration,
  type DeviceStatusIndicator,
} from '@/features/devices/utils/device-list-status'
import {
  resolveDeviceOnlineStatusCode,
  type DeviceOnlineStatusCode,
} from '@/features/devices/utils/device-online-status'
import { usePeriodicNow } from '@/shared/hooks/use-periodic-now'
import { useAuthStore } from '@/features/auth/store/auth-store'
import { Button } from '@/components/ui/button'
import type { DeviceListView, DeviceView } from '@/shared/api/types/device'
import type { Platform } from '@/shared/api/types/platform'
import { cn } from '@/lib/utils'

const STATUS_COLORS: Record<string, string> = {
  green: 'bg-emerald-500',
  red: 'bg-red-500',
  yellow: 'bg-amber-400',
  brown: 'bg-orange-700',
  grey: 'bg-slate-400',
}

const INDICATOR_COLORS: Record<DeviceStatusIndicator, string> = {
  green: 'bg-emerald-500',
  yellow: 'bg-amber-400',
  red: 'bg-red-500',
  grey: 'bg-slate-400',
}

const BITLOCKER_LABELS: Record<string, string> = {
  on: 'Encrypted',
  off: 'Off',
  unknown: 'Unknown',
}

const PS_LABELS: Record<string, string> = {
  idle: 'Idle',
  running: 'Running',
  failed: 'Failed',
}

function formatTimestamp(ms?: number): string {
  if (!ms) {
    return '—'
  }
  return new Date(ms).toLocaleString()
}

interface DeviceTableProps {
  data: DeviceListView
  platform: Platform
  isLoading?: boolean
  onEditDevice?: (device: DeviceView) => void
  onQrDevice?: (device: DeviceView) => void
  onDeleteDevice?: (device: DeviceView) => void
  onMenuAction?: (action: DeviceActionsMenuAction, device: DeviceView) => void
}

export function DeviceTable({
  data,
  platform,
  isLoading,
  onEditDevice,
  onQrDevice,
  onDeleteDevice,
  onMenuAction,
}: DeviceTableProps) {
  const { t } = useTranslation()
  const now = usePeriodicNow()
  const devices = data.devices.items
  const showActions = platform === 'android' && onEditDevice != null

  if (isLoading && devices.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
        {t('devices.loading')}
      </div>
    )
  }

  if (!isLoading && devices.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
        {t('devices.empty')}
      </div>
    )
  }

  if (platform === 'windows') {
    return (
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead className="border-b bg-muted/40 text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">{t('devices.columns.status')}</th>
              <th className="px-4 py-3 font-medium">{t('devices.columns.hostname')}</th>
              <th className="px-4 py-3 font-medium">{t('devices.columns.description')}</th>
              <th className="px-4 py-3 font-medium">{t('devices.columns.configuration')}</th>
              <th className="px-4 py-3 font-medium">{t('devices.columns.windowsBuild')}</th>
              <th className="px-4 py-3 font-medium">{t('devices.columns.bitlocker')}</th>
              <th className="px-4 py-3 font-medium">{t('devices.columns.powershell')}</th>
              <th className="px-4 py-3 font-medium">{t('devices.columns.lastUpdate')}</th>
            </tr>
          </thead>
          <tbody>
            {devices.map((device) => (
              <WindowsDeviceRow
                key={device.id}
                device={device}
                configurations={data.configurations}
                now={now}
              />
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="w-full min-w-[1200px] text-left text-sm">
        <thead className="border-b bg-muted/40 text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">{t('devices.columns.status')}</th>
            <th className="px-4 py-3 font-medium">{t('devices.columns.date')}</th>
            <th className="px-4 py-3 font-medium">{t('devices.columns.number')}</th>
            <th className="px-4 py-3 font-medium">{t('devices.columns.model')}</th>
            <th className="px-4 py-3 font-medium">{t('devices.columns.permissions')}</th>
            <th className="px-4 py-3 font-medium">{t('devices.columns.installations')}</th>
            <th className="px-4 py-3 font-medium">{t('devices.columns.files')}</th>
            <th className="px-4 py-3 font-medium">{t('devices.columns.configuration')}</th>
            <th className="px-4 py-3 font-medium">{t('devices.columns.battery')}</th>
            <th className="px-4 py-3 font-medium">{t('devices.columns.androidVersion')}</th>
            <th className="px-4 py-3 font-medium">{t('devices.columns.publicIp')}</th>
            {showActions && (
              <th className="px-4 py-3 font-medium text-right">{t('devices.columns.actions')}</th>
            )}
          </tr>
        </thead>
        <tbody>
          {devices.map((device) => (
            <AndroidDeviceRow
              key={device.id}
              device={device}
              configurations={data.configurations}
              showActions={showActions}
              now={now}
              onEditDevice={onEditDevice}
              onQrDevice={onQrDevice}
              onDeleteDevice={onDeleteDevice}
              onMenuAction={onMenuAction}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function StatusDot({
  statusCode,
  title,
}: {
  statusCode?: DeviceOnlineStatusCode
  title?: string
}) {
  const statusClass = STATUS_COLORS[statusCode ?? 'grey'] ?? STATUS_COLORS.grey
  return (
    <span className="inline-flex items-center gap-2" title={title}>
      <span className={cn('size-2.5 rounded-full', statusClass)} aria-hidden />
      <span className="sr-only">{title ?? statusCode}</span>
    </span>
  )
}

function ComplianceDot({
  indicator,
  title,
}: {
  indicator: DeviceStatusIndicator
  title: string
}) {
  return (
    <span title={title} aria-label={title}>
      <span
        className={cn('inline-block size-2.5 rounded-full', INDICATOR_COLORS[indicator])}
        aria-hidden
      />
    </span>
  )
}

function ConfigurationCell({
  device,
  configurations,
}: {
  device: DeviceView
  configurations: DeviceListView['configurations']
}) {
  const canOpenConfiguration = useAuthStore((state) => state.hasPermission('configurations'))
  const name = getConfigurationName(configurations, device.configurationId)

  if (canOpenConfiguration) {
    return (
      <Link
        to="/configurations/$configId"
        params={{ configId: String(device.configurationId) }}
        className="text-primary hover:underline"
      >
        {name}
      </Link>
    )
  }

  return <span>{name}</span>
}

function DeviceRowActions({
  device,
  configurations,
  onEditDevice,
  onQrDevice,
  onDeleteDevice,
  onMenuAction,
}: {
  device: DeviceView
  configurations: DeviceListView['configurations']
  onEditDevice?: (device: DeviceView) => void
  onQrDevice?: (device: DeviceView) => void
  onDeleteDevice?: (device: DeviceView) => void
  onMenuAction?: (action: DeviceActionsMenuAction, device: DeviceView) => void
}) {
  const { t } = useTranslation()
  const qrCodeKey = getConfigurationQrCodeKey(configurations, device.configurationId)

  return (
    <div className="flex items-center justify-end gap-0.5">
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        title={t('devices.actions.edit')}
        onClick={() => onEditDevice?.(device)}
      >
        <Pencil className="size-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        title={t('devices.actions.qr')}
        disabled={!qrCodeKey}
        onClick={() => onQrDevice?.(device)}
      >
        <QrCode className="size-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        title={t('devices.actions.delete')}
        className="text-destructive hover:text-destructive"
        onClick={() => onDeleteDevice?.(device)}
      >
        <Trash2 className="size-3.5" />
      </Button>
      {onMenuAction && <DeviceActionsMenu device={device} onAction={onMenuAction} />}
    </div>
  )
}

function AndroidDeviceRow({
  device,
  configurations,
  showActions,
  now,
  onEditDevice,
  onQrDevice,
  onDeleteDevice,
  onMenuAction,
}: {
  device: DeviceView
  configurations: DeviceListView['configurations']
  showActions: boolean
  now: number
  onEditDevice?: (device: DeviceView) => void
  onQrDevice?: (device: DeviceView) => void
  onDeleteDevice?: (device: DeviceView) => void
  onMenuAction?: (action: DeviceActionsMenuAction, device: DeviceView) => void
}) {
  const { t } = useTranslation()
  const configuration = resolveDeviceConfiguration(configurations, device.configurationId)
  const battery = device.info?.batteryLevel
  const model = device.model ?? device.info?.model
  const onlineStatus = resolveDeviceOnlineStatusCode(device, now)
  const permissionIndicator = getDevicePermissionIndicator(device, configuration)
  const installIndicator = getDeviceInstallIndicator(device, configuration)
  const filesIndicator = getDeviceFilesIndicator(device, configuration)

  return (
    <tr className="border-b last:border-b-0 hover:bg-muted/20">
      <td className="px-4 py-3">
        <StatusDot
          statusCode={onlineStatus}
          title={t(`devices.status.${onlineStatus}`)}
        />
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        {device.lastUpdate ? formatTimestamp(device.lastUpdate) : t('devices.date.unknown')}
      </td>
      <td className="px-4 py-3 font-medium">
        <Link
          to="/devices/$deviceNumber"
          params={{ deviceNumber: device.number }}
          className="text-primary hover:underline"
        >
          {device.number}
        </Link>
      </td>
      <td className="px-4 py-3">{model ?? t('devices.model.unknown')}</td>
      <td className="px-4 py-3">
        <ComplianceDot
          indicator={permissionIndicator}
          title={t(`devices.compliance.${permissionIndicator}`)}
        />
      </td>
      <td className="px-4 py-3">
        <ComplianceDot
          indicator={installIndicator}
          title={t(`devices.compliance.${installIndicator}`)}
        />
      </td>
      <td className="px-4 py-3">
        <ComplianceDot
          indicator={filesIndicator}
          title={t(`devices.compliance.${filesIndicator}`)}
        />
      </td>
      <td className="px-4 py-3">
        <ConfigurationCell device={device} configurations={configurations} />
      </td>
      <td className="px-4 py-3">
        {battery != null ? (
          <span
            className={cn(
              'font-medium',
              battery <= 20 && 'text-red-600',
              battery > 20 && battery <= 50 && 'text-amber-600',
            )}
          >
            {battery}%
          </span>
        ) : (
          '—'
        )}
      </td>
      <td className="px-4 py-3">{device.androidVersion ?? device.info?.androidVersion ?? '—'}</td>
      <td className="px-4 py-3 font-mono text-xs">{device.publicIp ?? '—'}</td>
      {showActions && (
        <td className="px-4 py-3">
          <DeviceRowActions
            device={device}
            configurations={configurations}
            onEditDevice={onEditDevice}
            onQrDevice={onQrDevice}
            onDeleteDevice={onDeleteDevice}
            onMenuAction={onMenuAction}
          />
        </td>
      )}
    </tr>
  )
}

function WindowsDeviceRow({
  device,
  configurations,
  now,
}: {
  device: DeviceView
  configurations: DeviceListView['configurations']
  now: number
}) {
  const { t } = useTranslation()
  const onlineStatus = resolveDeviceOnlineStatusCode(device, now)

  return (
    <tr className="border-b last:border-b-0 hover:bg-muted/20">
      <td className="px-4 py-3">
        <StatusDot
          statusCode={onlineStatus}
          title={t(`devices.status.${onlineStatus}`)}
        />
      </td>
      <td className="px-4 py-3 font-mono text-xs font-medium">
        <Link
          to="/devices/$deviceNumber"
          params={{ deviceNumber: device.number }}
          className="text-primary hover:underline"
        >
          {device.hostname ?? device.number}
        </Link>
      </td>
      <td className="px-4 py-3 text-muted-foreground">{device.description || '—'}</td>
      <td className="px-4 py-3">
        <ConfigurationCell device={device} configurations={configurations} />
      </td>
      <td className="px-4 py-3 font-mono text-xs">{device.windowsBuild ?? '—'}</td>
      <td className="px-4 py-3">
        {BITLOCKER_LABELS[device.bitlockerStatus ?? 'unknown'] ?? '—'}
      </td>
      <td className="px-4 py-3">
        {PS_LABELS[device.powershellExecStatus ?? 'idle'] ?? '—'}
      </td>
      <td className="px-4 py-3 whitespace-nowrap">{formatTimestamp(device.lastUpdate)}</td>
    </tr>
  )
}
