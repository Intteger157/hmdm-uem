import { useTranslation } from 'react-i18next'
import { AndroidIcon, ANDROID_BRAND_COLOR } from '@/components/icons/platform-icons'
import { OverviewSection, OverviewFieldRow, OverviewStatusRow } from '@/features/devices/components/device-overview/OverviewSection'
import { OverviewCopyButton } from '@/features/devices/components/device-overview/OverviewCopyButton'
import { DEVICE_OVERVIEW_GRID_CLASS } from '@/features/devices/components/device-overview/device-detail-layout-styles'
import {
  BatteryOverviewTelemetry,
  NetworkOverviewFields,
} from '@/features/devices/components/device-overview/device-overview-widgets'
import {
  formatDeviceEnrollTime,
  formatDeviceTimestamp,
  resolveEnrollTime,
  resolveLauncherVersion,
} from '@/features/devices/utils/device-detail-formatters'
import type { DeviceView } from '@/shared/api/types/device'
import { cn } from '@/lib/utils'

const NA = 'N/A'

interface AndroidDeviceOverviewProps {
  device: DeviceView
}

export function AndroidDeviceOverview({ device }: AndroidDeviceOverviewProps) {
  const { t } = useTranslation()
  const androidVersion = device.androidVersion ?? device.info?.androidVersion
  const launcherVersion = resolveLauncherVersion(device)
  const enrollTime = resolveEnrollTime(device)
  const model = device.model ?? device.manufacturer ?? device.info?.model
  const serial = device.serialNumber ?? device.serial ?? device.info?.serial
  const imei = device.imei ?? device.info?.imei
  const isManaged = device.mdmMode === true

  return (
    <div className="space-y-5">
      <div className={DEVICE_OVERVIEW_GRID_CLASS}>
        <OverviewSection title={t('deviceDetail.sections.identity')}>
          <OverviewFieldRow
            label={t('devices.columns.description')}
            value={device.description ?? device.hostname ?? NA}
          />
          <OverviewFieldRow label={t('deviceDetail.metrics.model')} value={model ?? NA} />
          <OverviewFieldRow
            label={t('deviceDetail.metrics.serial')}
            value={serial ?? NA}
            mono
            action={serial ? <OverviewCopyButton value={serial} /> : undefined}
          />
          <OverviewFieldRow label={t('devices.columns.number')} value={device.number} mono />
          <OverviewFieldRow
            label={t('devices.columns.imei')}
            value={imei ?? NA}
            mono
            action={imei ? <OverviewCopyButton value={imei} /> : undefined}
          />
          <OverviewFieldRow
            label={t('deviceDetail.metrics.manufacturer')}
            value={device.manufacturer ?? NA}
          />
        </OverviewSection>

        <OverviewSection title={t('deviceDetail.sections.systemHealth')}>
          <OverviewFieldRow
            label={t('deviceDetail.metrics.lastOnline')}
            value={formatDeviceTimestamp(device.lastUpdate)}
          />
          <OverviewFieldRow
            label={t('devices.columns.androidVersion')}
            value={
              androidVersion ? (
                <span className="inline-flex items-center gap-2">
                  <AndroidIcon className={cn('size-4', ANDROID_BRAND_COLOR)} />
                  {androidVersion}
                </span>
              ) : (
                NA
              )
            }
          />
          <OverviewFieldRow
            label={t('devices.columns.launcherVersion')}
            value={launcherVersion ?? NA}
          />
          <OverviewFieldRow
            label={t('deviceDetail.metrics.enrolled')}
            value={
              enrollTime != null ? formatDeviceEnrollTime(enrollTime) : t('devices.date.unknown')
            }
          />
          {device.info?.defaultLauncher != null ? (
            <OverviewFieldRow
              label={t('deviceDetail.metrics.defaultLauncher')}
              value={
                device.info.defaultLauncher
                  ? t('deviceDetail.overview.yes')
                  : t('deviceDetail.overview.no')
              }
            />
          ) : null}
        </OverviewSection>

        <OverviewSection title={t('deviceDetail.sections.hardware')}>
          <OverviewFieldRow label={t('deviceDetail.metrics.model')} value={model ?? NA} />
          <BatteryOverviewTelemetry device={device} />
        </OverviewSection>

        <OverviewSection title={t('deviceDetail.sections.network')}>
          <NetworkOverviewFields device={device} />
        </OverviewSection>
      </div>

      <OverviewSection title={t('deviceDetail.sections.securityManagement')}>
        <OverviewStatusRow
          label={t('deviceDetail.overview.deviceManagement')}
          status={isManaged ? 'healthy' : 'neutral'}
          title={
            isManaged
              ? t('deviceDetail.overview.managed')
              : t('deviceDetail.overview.notManaged')
          }
          detail={
            device.kioskMode
              ? t('deviceDetail.overview.kioskEnabled')
              : undefined
          }
        />
        <div className="mt-4 border-t border-border/50 pt-4 dark:border-[#242424]/80">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t('deviceDetail.sections.management')}
          </p>
          {device.configurationName ? (
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">{device.configurationName}</p>
              <p className="text-xs text-muted-foreground">
                {t('deviceDetail.appliedConfiguration.direct')}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t('deviceDetail.appliedConfiguration.none')}
            </p>
          )}
        </div>
      </OverviewSection>
    </div>
  )
}
