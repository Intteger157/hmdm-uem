import { useTranslation } from 'react-i18next'
import { Package } from 'lucide-react'
import { useDeviceAppStatusesQuery } from '@/features/windows/applications/hooks/use-windows-software-apps'
import type { AppDeploymentStatus } from '@/features/windows/applications/types/software-app'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface WindowsAppDeploymentsCardProps {
  hardwareId: string
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

export function WindowsAppDeploymentsCard({ hardwareId }: WindowsAppDeploymentsCardProps) {
  const { t } = useTranslation()
  const { data, isLoading, isError } = useDeviceAppStatusesQuery(hardwareId)
  const items = data?.items ?? []
  const successCount = items.filter((item) => item.status === 'Success').length

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-16 w-full" />
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

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <Package className="size-4 text-muted-foreground" />
              {t('deviceDetail.appDeployments.title')}
            </CardTitle>
            <CardDescription>
              {inProgress
                ? t('deviceDetail.appDeployments.installing', {
                    current: successCount + 1,
                    total: items.length,
                  })
                : t('deviceDetail.appDeployments.progress', {
                    count: successCount,
                    total: items.length,
                  })}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-muted/50">
              <tr className="text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">{t('deviceDetail.appDeployments.columns.app')}</th>
                <th className="px-4 py-2.5 font-medium">{t('deviceDetail.appDeployments.columns.status')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.appId} className="border-b last:border-0">
                  <td className="px-4 py-2.5">
                    <div className="font-medium">{item.appName}</div>
                    {item.errorMessage ? (
                      <div className="mt-0.5 text-xs text-destructive">{item.errorMessage}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge
                      variant={statusBadgeVariant(item.status)}
                      className={cn(statusBadgeClassName(item.status))}
                    >
                      {t(`deviceDetail.appDeployments.status.${item.status}`)}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
