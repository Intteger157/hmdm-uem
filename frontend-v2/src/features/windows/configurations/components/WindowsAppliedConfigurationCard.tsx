import { useTranslation } from 'react-i18next'
import { Shield } from 'lucide-react'
import { useWindowsDeviceEffectiveConfigQuery } from '@/features/windows/configurations/hooks/use-windows-config-profiles'
import type { WindowsConfigProfilePayload } from '@/features/windows/configurations/types/config-profile'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import {
  OVERVIEW_CARD_CONTENT_CLASS,
  OVERVIEW_CARD_HEADER_CLASS,
  OVERVIEW_FLAT_CARD_CLASS,
} from '@/features/devices/components/overview-card-styles'
import type { TFunction } from 'i18next'

interface WindowsAppliedConfigurationCardProps {
  hardwareId: string
  className?: string
}

const CONFIGURATION_TAG_CLASS =
  'rounded border border-gray-700 bg-gray-800 px-2 py-0.5 text-xs font-medium text-gray-200'

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

export function WindowsAppliedConfigurationCard({
  hardwareId,
  className,
}: WindowsAppliedConfigurationCardProps) {
  const { t } = useTranslation()
  const { data, isLoading, isError } = useWindowsDeviceEffectiveConfigQuery(hardwareId)

  if (isLoading) {
    return (
      <Card className={cn('h-full', OVERVIEW_FLAT_CARD_CLASS, className)}>
        <CardHeader className={OVERVIEW_CARD_HEADER_CLASS}>
          <Skeleton className="h-3 w-32" />
          <Skeleton className="size-4 rounded-full" />
        </CardHeader>
        <CardContent className={OVERVIEW_CARD_CONTENT_CLASS}>
          <Skeleton className="h-4 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (isError) {
    return (
      <Card className={cn('h-full', OVERVIEW_FLAT_CARD_CLASS, className)}>
        <CardHeader className={OVERVIEW_CARD_HEADER_CLASS}>
          <CardTitle className="text-xs font-medium text-muted-foreground">
            {t('deviceDetail.appliedConfiguration.title')}
          </CardTitle>
          <Shield className="size-4 text-muted-foreground/70" />
        </CardHeader>
        <CardContent className={cn(OVERVIEW_CARD_CONTENT_CLASS, 'text-xs text-destructive')}>
          {t('deviceDetail.appliedConfiguration.loadFailed')}
        </CardContent>
      </Card>
    )
  }

  const hasProfile = Boolean(data?.profileName)
  const configurationTags = data?.payload ? buildConfigurationTags(data.payload, t) : []

  return (
    <Card className={cn('h-full', OVERVIEW_FLAT_CARD_CLASS, className)}>
      <CardHeader className={OVERVIEW_CARD_HEADER_CLASS}>
        <CardTitle className="text-xs font-medium text-muted-foreground">
          {t('deviceDetail.appliedConfiguration.title')}
        </CardTitle>
        <Shield className="size-4 text-muted-foreground/70" />
      </CardHeader>
      <CardContent className={cn(OVERVIEW_CARD_CONTENT_CLASS, 'space-y-2')}>
        {hasProfile ? (
          <>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-sm font-semibold leading-tight">{data?.profileName}</span>
              {data?.source ? (
                <Badge variant={data.source === 'direct' ? 'default' : 'secondary'} className="text-[10px]">
                  {data.source === 'direct'
                    ? t('deviceDetail.appliedConfiguration.direct')
                    : t('deviceDetail.appliedConfiguration.group')}
                </Badge>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {configurationTags.map((tag) => (
                <span key={tag} className={CONFIGURATION_TAG_CLASS}>
                  {tag}
                </span>
              ))}
            </div>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">{t('deviceDetail.appliedConfiguration.none')}</p>
        )}
      </CardContent>
    </Card>
  )
}
