import { useTranslation } from 'react-i18next'
import { getConfigurationName } from '@/features/devices/api/devices-api'
import type { DeviceListView, DeviceView } from '@/shared/api/types/device'
import { cn } from '@/lib/utils'

const STATUS_COLORS: Record<string, string> = {
  green: 'bg-emerald-500',
  red: 'bg-red-500',
  yellow: 'bg-amber-400',
  brown: 'bg-orange-700',
  grey: 'bg-slate-400',
}

function formatTimestamp(ms?: number): string {
  if (!ms) {
    return '—'
  }
  return new Date(ms).toLocaleString()
}

interface DeviceTableProps {
  data: DeviceListView
  isLoading?: boolean
}

export function DeviceTable({ data, isLoading }: DeviceTableProps) {
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
            <th className="px-4 py-3 font-medium">{t('devices.columns.launcherVersion')}</th>
            <th className="px-4 py-3 font-medium">{t('devices.columns.lastUpdate')}</th>
            <th className="px-4 py-3 font-medium">{t('devices.columns.imei')}</th>
          </tr>
        </thead>
        <tbody>
          {devices.map((device) => (
            <DeviceRow
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

function DeviceRow({
  device,
  configurations,
}: {
  device: DeviceView
  configurations: DeviceListView['configurations']
}) {
  const statusClass = STATUS_COLORS[device.statusCode ?? 'grey'] ?? STATUS_COLORS.grey

  return (
    <tr className="border-b last:border-b-0 hover:bg-muted/20">
      <td className="px-4 py-3">
        <span className="inline-flex items-center gap-2">
          <span className={cn('size-2.5 rounded-full', statusClass)} aria-hidden />
          <span className="sr-only">{device.statusCode}</span>
        </span>
      </td>
      <td className="px-4 py-3 font-medium">{device.number}</td>
      <td className="px-4 py-3 text-muted-foreground">{device.description || '—'}</td>
      <td className="px-4 py-3">
        {getConfigurationName(configurations, device.configurationId)}
      </td>
      <td className="px-4 py-3">{device.androidVersion ?? device.info?.androidVersion ?? '—'}</td>
      <td className="px-4 py-3">{device.launcherVersion ?? '—'}</td>
      <td className="px-4 py-3 whitespace-nowrap">{formatTimestamp(device.lastUpdate)}</td>
      <td className="px-4 py-3 font-mono text-xs">{device.imei ?? device.info?.imei ?? '—'}</td>
    </tr>
  )
}
