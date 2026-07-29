import { Package } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useDeviceAppStatusesQuery } from '@/features/windows/applications/hooks/use-windows-software-apps'
import type { AppDeploymentStatus } from '@/features/windows/applications/types/software-app'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import {
  OVERVIEW_CARD_CONTENT_CLASS,
  OVERVIEW_CARD_HEADER_CLASS,
  OVERVIEW_FLAT_CARD_CLASS,
} from '@/features/devices/components/overview-card-styles'

interface WindowsAppDeploymentsCardProps {
  hardwareId: string
  className?: string
}

function statusBadgeVariant(status: AppDeploymentStatus) {
  switch (status) {
    case 'Success':
      return 'default'
    case 'Failed':
      return 'destructive'
    case 'Downloading':
    case 'Installing':
      return 'secondary'
    default:
      return 'outline'
  }
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
    case 'Failed':
      return ''
    default:
      return ''
  }
}

export function WindowsAppDeploymentsCard({ hardwareId, className }: WindowsAppDeploymentsCardProps) {
  const { t } = useTranslation()
  const { data, isLoading, isError } = useDeviceAppStatusesQuery(hardwareId)
  const items = data?.items ?? []
  const successCount = items.filter((item) => item.status === 'Success').length

  if (isLoading) {
    return (
      <Card className={cn(OVERVIEW_FLAT_CARD_CLASS, 'overflow-visible', className)}>
        <CardHeader className={OVERVIEW_CARD_HEADER_CLASS}>
          <Skeleton className="h-3 w-28" />
          <Skeleton className="size-4 rounded-full" />
        </CardHeader>
        <CardContent className={OVERVIEW_CARD_CONTENT_CLASS}>
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (isError || items.length === 0) {
    return null
  }

  const inProgress = items.some(
    (item) => item.status === 'Pending' || item.status === 'Downloading' || item.status === 'Installing',
  )
  const hasActiveInstall = items.some(
    (item) => item.status === 'Downloading' || item.status === 'Installing',
  )
  const onlyPending = inProgress && !hasActiveInstall

  return (
    <Card className={cn(OVERVIEW_FLAT_CARD_CLASS, 'overflow-visible', className)}>
      <CardHeader className={OVERVIEW_CARD_HEADER_CLASS}>
        <div className="min-w-0 space-y-0.5">
          <CardTitle className="text-xs font-medium text-muted-foreground">
            {t('deviceDetail.appDeployments.title')}
          </CardTitle>
          <p className="text-[11px] leading-tight text-muted-foreground">
            {onlyPending
              ? t('deviceDetail.appDeployments.waitingForAgent', { total: items.length })
              : inProgress
                ? t('deviceDetail.appDeployments.installing', {
                    current: successCount + 1,
                    total: items.length,
                  })
                : t('deviceDetail.appDeployments.progress', {
                    count: successCount,
                    total: items.length,
                  })}
          </p>
        </div>
        <Package className="size-4 shrink-0 text-muted-foreground/70" />
      </CardHeader>
      <CardContent className={cn(OVERVIEW_CARD_CONTENT_CLASS, 'divide-y divide-border')}>
        {items.map((item) => (
          <div key={item.appId} className="flex items-center justify-between gap-3 py-1.5 first:pt-0 last:pb-0">
            <p className="min-w-0 truncate text-sm font-medium leading-tight">{item.appName}</p>
            <Badge
              variant={statusBadgeVariant(item.status)}
              className={cn('shrink-0 text-[10px]', statusBadgeClassName(item.status))}
            >
              {t(`deviceDetail.appDeployments.status.${item.status}`)}
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
