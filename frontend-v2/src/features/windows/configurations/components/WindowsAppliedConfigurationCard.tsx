import { useTranslation } from 'react-i18next'
import { Shield } from 'lucide-react'
import { useWindowsDeviceEffectiveConfigQuery } from '@/features/windows/configurations/hooks/use-windows-config-profiles'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface WindowsAppliedConfigurationCardProps {
  hardwareId: string
  className?: string
}

const CARD_HEADER_CLASS = 'flex flex-row items-center justify-between space-y-0 px-3 pb-1 pt-2.5'
const CARD_CONTENT_CLASS = 'px-3 pb-2.5'

export function WindowsAppliedConfigurationCard({
  hardwareId,
  className,
}: WindowsAppliedConfigurationCardProps) {
  const { t } = useTranslation()
  const { data, isLoading, isError } = useWindowsDeviceEffectiveConfigQuery(hardwareId)

  if (isLoading) {
    return (
      <Card className={cn('h-full', className)}>
        <CardHeader className={CARD_HEADER_CLASS}>
          <Skeleton className="h-3 w-32" />
          <Skeleton className="size-4 rounded-full" />
        </CardHeader>
        <CardContent className={CARD_CONTENT_CLASS}>
          <Skeleton className="h-4 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (isError) {
    return (
      <Card className={cn('h-full', className)}>
        <CardHeader className={CARD_HEADER_CLASS}>
          <CardTitle className="text-xs font-medium text-muted-foreground">
            {t('deviceDetail.appliedConfiguration.title')}
          </CardTitle>
          <Shield className="size-4 text-muted-foreground/70" />
        </CardHeader>
        <CardContent className={cn(CARD_CONTENT_CLASS, 'text-xs text-destructive')}>
          {t('deviceDetail.appliedConfiguration.loadFailed')}
        </CardContent>
      </Card>
    )
  }

  const hasProfile = Boolean(data?.profileName)

  return (
    <Card className={cn('h-full', className)}>
      <CardHeader className={CARD_HEADER_CLASS}>
        <CardTitle className="text-xs font-medium text-muted-foreground">
          {t('deviceDetail.appliedConfiguration.title')}
        </CardTitle>
        <Shield className="size-4 text-muted-foreground/70" />
      </CardHeader>
      <CardContent className={cn(CARD_CONTENT_CLASS, 'space-y-1.5')}>
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
            <p className="text-xs leading-relaxed text-muted-foreground">
              {t('deviceDetail.appliedConfiguration.summary', {
                defender: data?.payload.defenderEnabled
                  ? t('deviceDetail.appliedConfiguration.enabled')
                  : t('deviceDetail.appliedConfiguration.disabled'),
                usb: data?.payload.blockUsbStorage
                  ? t('deviceDetail.appliedConfiguration.blocked')
                  : t('deviceDetail.appliedConfiguration.allowed'),
                usbReadOnly: data?.payload.usbReadOnly
                  ? t('deviceDetail.appliedConfiguration.readOnly')
                  : t('deviceDetail.appliedConfiguration.readWrite'),
                lockTimeout: data?.payload.screenLockTimeout ?? 0,
              })}
            </p>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">{t('deviceDetail.appliedConfiguration.none')}</p>
        )}
      </CardContent>
    </Card>
  )
}
