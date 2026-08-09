import { useTranslation } from 'react-i18next'
import { Package, Shield } from 'lucide-react'
import { useWindowsDeviceEffectiveConfigQuery } from '@/features/windows/configurations/hooks/use-windows-config-profiles'
import type { WindowsConfigProfilePayload } from '@/features/windows/configurations/types/config-profile'
import { useDeviceAppStatusesQuery } from '@/features/windows/applications/hooks/use-windows-software-apps'
import type { AppDeploymentStatus } from '@/features/windows/applications/types/software-app'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import type { TFunction } from 'i18next'

const CONFIGURATION_TAG_CLASS =
  'rounded border border-border/80 bg-muted/30 px-2 py-0.5 text-xs font-medium text-muted-foreground dark:border-[#242424]'

function buildConfigurationTags(payload: WindowsConfigProfilePayload, t: TFunction): string[] {
  return [
    t('deviceDetail.appliedConfiguration.tagDefender', {
      state: payload.defenderEnabled
        ? t('deviceDetail.appliedConfiguration.enabled')
        : t('deviceDetail.appliedConfiguration.disabled'),
    }),
    t('deviceDetail.appliedConfiguration.tagUsbBlock', {
      state: payload.blockUsbStorage
        ? t('deviceDetail.appliedConfiguration.blocked')
        : t('deviceDetail.appliedConfiguration.allowed'),
    }),
    t('deviceDetail.appliedConfiguration.tagUsbAccess', {
      state: payload.usbReadOnly
        ? t('deviceDetail.appliedConfiguration.readOnly')
        : t('deviceDetail.appliedConfiguration.readWrite'),
    }),
    t('deviceDetail.appliedConfiguration.tagBitLocker', {
      state: payload.requireBitLocker
        ? t('deviceDetail.appliedConfiguration.enabled')
        : t('deviceDetail.appliedConfiguration.disabled'),
    }),
    t('deviceDetail.appliedConfiguration.tagScreenLock', {
      minutes: payload.screenLockTimeout ?? 0,
    }),
  ]
}

function statusBadgeClassName(status: AppDeploymentStatus) {
  switch (status) {
    case 'Pending':
      return 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'
    case 'Success':
      return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
    case 'Downloading':
    case 'Installing':
      return 'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300'
    default:
      return ''
  }
}

interface WindowsManagementSectionProps {
  hardwareId: string
}

export function WindowsManagementSection({ hardwareId }: WindowsManagementSectionProps) {
  const { t } = useTranslation()
  const configQuery = useWindowsDeviceEffectiveConfigQuery(hardwareId)
  const deploymentsQuery = useDeviceAppStatusesQuery(hardwareId)
  const deploymentItems = deploymentsQuery.data?.items ?? []

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-3 flex items-center gap-2">
          <Shield className="size-3.5 text-muted-foreground" />
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t('deviceDetail.appliedConfiguration.title')}
          </p>
        </div>
        {configQuery.isLoading ? (
          <Skeleton className="h-10 w-full max-w-sm" />
        ) : configQuery.isError ? (
          <p className="text-sm text-destructive">{t('deviceDetail.appliedConfiguration.loadFailed')}</p>
        ) : configQuery.data?.profileName ? (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold">{configQuery.data.profileName}</span>
              {configQuery.data.source ? (
                <Badge variant={configQuery.data.source === 'direct' ? 'default' : 'secondary'} className="text-[10px]">
                  {configQuery.data.source === 'direct'
                    ? t('deviceDetail.appliedConfiguration.direct')
                    : t('deviceDetail.appliedConfiguration.group')}
                </Badge>
              ) : null}
            </div>
            {configQuery.data.payload ? (
              <div className="flex flex-wrap gap-1.5">
                {buildConfigurationTags(configQuery.data.payload, t).map((tag) => (
                  <span key={tag} className={CONFIGURATION_TAG_CLASS}>
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t('deviceDetail.appliedConfiguration.none')}</p>
        )}
      </div>

      <div>
        <div className="mb-3 flex items-center gap-2">
          <Package className="size-3.5 text-muted-foreground" />
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t('deviceDetail.appDeployments.title')}
          </p>
        </div>
        {deploymentsQuery.isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : deploymentsQuery.isError ? (
          <p className="text-sm text-destructive">{t('deviceDetail.appDeployments.deployLoadError')}</p>
        ) : deploymentItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('deviceDetail.appDeployments.none')}</p>
        ) : (
          <ul className="space-y-2">
            {deploymentItems.map((item) => (
              <li
                key={item.appId}
                className="flex items-center justify-between gap-3 rounded-md border border-border/50 px-3 py-2 text-sm dark:border-[#242424]/80"
              >
                <span className="min-w-0 truncate font-medium">{item.appName}</span>
                <Badge variant="outline" className={statusBadgeClassName(item.status)}>
                  {t(`deviceDetail.appDeployments.status.${item.status}`)}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
