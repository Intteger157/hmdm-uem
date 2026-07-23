import { useTranslation } from 'react-i18next'
import { Shield } from 'lucide-react'
import { useWindowsDeviceEffectiveConfigQuery } from '@/features/windows/configurations/hooks/use-windows-config-profiles'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

interface WindowsAppliedConfigurationCardProps {
  hardwareId: string
}

export function WindowsAppliedConfigurationCard({ hardwareId }: WindowsAppliedConfigurationCardProps) {
  const { t } = useTranslation()
  const { data, isLoading, isError } = useWindowsDeviceEffectiveConfigQuery(hardwareId)

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-4 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (isError) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">{t('deviceDetail.appliedConfiguration.title')}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-destructive">
          {t('deviceDetail.appliedConfiguration.loadFailed')}
        </CardContent>
      </Card>
    )
  }

  const hasProfile = Boolean(data?.profileName)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{t('deviceDetail.appliedConfiguration.title')}</CardTitle>
        <Shield className="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="space-y-2">
        {hasProfile ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{data?.profileName}</span>
              {data?.source ? (
                <Badge variant={data.source === 'direct' ? 'default' : 'secondary'}>
                  {data.source === 'direct'
                    ? t('deviceDetail.appliedConfiguration.direct')
                    : t('deviceDetail.appliedConfiguration.group')}
                </Badge>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
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
          <p className="text-sm text-muted-foreground">{t('deviceDetail.appliedConfiguration.none')}</p>
        )}
      </CardContent>
    </Card>
  )
}
