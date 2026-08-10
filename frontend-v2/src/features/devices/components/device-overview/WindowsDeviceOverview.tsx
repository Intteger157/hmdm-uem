import { useTranslation } from 'react-i18next'
import { OverviewSection, OverviewFieldRow } from '@/features/devices/components/device-overview/OverviewSection'
import { OverviewCopyButton } from '@/features/devices/components/device-overview/OverviewCopyButton'
import { DEVICE_OVERVIEW_GRID_CLASS } from '@/features/devices/components/device-overview/device-detail-layout-styles'
import {
  AntivirusOverviewStatus,
  BatteryOverviewTelemetry,
  BitLockerOverviewStatus,
  CpuOverviewField,
  DiskOverviewTelemetry,
  NetworkOverviewFields,
  WindowsUpdateOverviewStatus,
} from '@/features/devices/components/device-overview/device-overview-widgets'
import { WindowsManagementSection } from '@/features/devices/components/device-overview/WindowsManagementSection'
import {
  formatDeviceTimestamp,
  formatUptime,
  formatWindowsCurrentUser,
  resolveEnrollTime,
} from '@/features/devices/utils/device-detail-formatters'
import type { DeviceView } from '@/shared/api/types/device'

const NA = 'N/A'

interface WindowsDeviceOverviewProps {
  device: DeviceView
}

export function WindowsDeviceOverview({ device }: WindowsDeviceOverviewProps) {
  const { t } = useTranslation()
  const enrollTime = resolveEnrollTime(device)

  return (
    <div className="space-y-5">
      <div className={DEVICE_OVERVIEW_GRID_CLASS}>
        <OverviewSection title={t('deviceDetail.sections.identity')}>
          <OverviewFieldRow
            label={t('devices.columns.hostname')}
            value={device.hostname ?? NA}
            mono
            action={
              device.hostname ? <OverviewCopyButton value={device.hostname} /> : undefined
            }
          />
          <OverviewFieldRow
            label={t('deviceDetail.metrics.model')}
            value={device.model ?? device.manufacturer ?? NA}
          />
          <OverviewFieldRow
            label={t('deviceDetail.metrics.serial')}
            value={device.serialNumber ?? device.serial ?? NA}
            mono
            action={
              (device.serialNumber ?? device.serial) ? (
                <OverviewCopyButton value={device.serialNumber ?? device.serial ?? ''} />
              ) : undefined
            }
          />
          <OverviewFieldRow label={t('devices.columns.number')} value={device.number} mono />
          <OverviewFieldRow
            label={t('devices.columns.windowsBuild')}
            value={device.windowsBuild ?? NA}
          />
          <OverviewFieldRow
            label={t('deviceDetail.metrics.manufacturer')}
            value={device.manufacturer ?? NA}
          />
        </OverviewSection>

        <OverviewSection title={t('deviceDetail.sections.systemHealth')}>
          <OverviewFieldRow
            label={t('deviceDetail.metrics.uptime')}
            value={formatUptime(device.uptimeSeconds)}
          />
          <OverviewFieldRow
            label={t('deviceDetail.metrics.lastOnline')}
            value={formatDeviceTimestamp(device.lastUpdate)}
          />
          <OverviewFieldRow
            label={t('deviceDetail.metrics.currentUser')}
            value={formatWindowsCurrentUser(device.currentUser, NA, device.localUsers)}
            mono
          />
          <WindowsUpdateOverviewStatus device={device} hardwareId={device.number} />
          <OverviewFieldRow
            label={t('deviceDetail.metrics.enrolled')}
            value={
              enrollTime != null ? formatDeviceTimestamp(enrollTime) : t('devices.date.unknown')
            }
          />
        </OverviewSection>

        <OverviewSection title={t('deviceDetail.sections.hardware')}>
          <CpuOverviewField device={device} />
          <OverviewFieldRow
            label={t('deviceDetail.metrics.ram')}
            value={device.ramGb != null ? `${device.ramGb} GB` : NA}
          />
          <DiskOverviewTelemetry device={device} />
          <BatteryOverviewTelemetry device={device} hardwareId={device.number} />
        </OverviewSection>

        <OverviewSection title={t('deviceDetail.sections.network')}>
          <NetworkOverviewFields device={device} />
        </OverviewSection>
      </div>

      <OverviewSection title={t('deviceDetail.sections.securityManagement')}>
        <AntivirusOverviewStatus device={device} />
        <BitLockerOverviewStatus device={device} t={t} />
        <div className="mt-4 border-t border-border/50 pt-4 dark:border-[#242424]/80">
          <WindowsManagementSection hardwareId={device.number} />
        </div>
      </OverviewSection>
    </div>
  )
}
