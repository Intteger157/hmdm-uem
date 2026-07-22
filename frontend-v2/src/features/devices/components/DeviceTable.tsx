import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { getConfigurationName } from '@/features/devices/api/devices-api'
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
}

export function DeviceTable({ data, platform, isLoading }: DeviceTableProps) {
  const { t } = useTranslation()
  const devices = data.devices.items

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
              />
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="w-full min-w-[960px] text-left text-sm">
        <thead className="border-b bg-muted/40 text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">{t('devices.columns.status')}</th>
            <th className="px-4 py-3 font-medium">{t('devices.columns.number')}</th>
            <th className="px-4 py-3 font-medium">{t('devices.columns.description')}</th>
            <th className="px-4 py-3 font-medium">{t('devices.columns.configuration')}</th>
            <th className="px-4 py-3 font-medium">{t('devices.columns.androidVersion')}</th>
            <th className="px-4 py-3 font-medium">{t('devices.columns.battery')}</th>
            <th className="px-4 py-3 font-medium">{t('devices.columns.launcherVersion')}</th>
            <th className="px-4 py-3 font-medium">{t('devices.columns.lastUpdate')}</th>
            <th className="px-4 py-3 font-medium">{t('devices.columns.imei')}</th>
          </tr>
        </thead>
        <tbody>
          {devices.map((device) => (
            <AndroidDeviceRow
              key={device.id}
              device={device}
              configurations={data.configurations}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function StatusDot({ statusCode }: { statusCode?: string }) {
  const statusClass = STATUS_COLORS[statusCode ?? 'grey'] ?? STATUS_COLORS.grey
  return (
    <span className="inline-flex items-center gap-2">
      <span className={cn('size-2.5 rounded-full', statusClass)} aria-hidden />
      <span className="sr-only">{statusCode}</span>
    </span>
  )
}

function AndroidDeviceRow({
  device,
  configurations,
}: {
  device: DeviceView
  configurations: DeviceListView['configurations']
}) {
  const battery = device.info?.batteryLevel

  return (
    <tr className="border-b last:border-b-0 hover:bg-muted/20">
      <td className="px-4 py-3">
        <StatusDot statusCode={device.statusCode} />
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
      <td className="px-4 py-3 text-muted-foreground">{device.description || '—'}</td>
      <td className="px-4 py-3">
        {getConfigurationName(configurations, device.configurationId)}
      </td>
      <td className="px-4 py-3">{device.androidVersion ?? device.info?.androidVersion ?? '—'}</td>
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
      <td className="px-4 py-3">{device.launcherVersion ?? '—'}</td>
      <td className="px-4 py-3 whitespace-nowrap">{formatTimestamp(device.lastUpdate)}</td>
      <td className="px-4 py-3 font-mono text-xs">{device.imei ?? device.info?.imei ?? '—'}</td>
    </tr>
  )
}

function WindowsDeviceRow({
  device,
  configurations,
}: {
  device: DeviceView
  configurations: DeviceListView['configurations']
}) {
  return (
    <tr className="border-b last:border-b-0 hover:bg-muted/20">
      <td className="px-4 py-3">
        <StatusDot statusCode={device.statusCode} />
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
        {getConfigurationName(configurations, device.configurationId)}
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
