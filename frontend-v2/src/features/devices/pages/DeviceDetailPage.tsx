import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { DeviceActionsPanel } from '@/features/devices/components/DeviceActionsPanel'
import { DeviceDetailCommandToastProvider } from '@/features/devices/context/device-detail-command-toast-context'
import { AndroidDeviceOverview } from '@/features/devices/components/device-overview/AndroidDeviceOverview'
import { DeviceDetailHeader } from '@/features/devices/components/device-overview/DeviceDetailHeader'
import { WindowsDeviceOverview } from '@/features/devices/components/device-overview/WindowsDeviceOverview'
import {
  DEVICE_DETAIL_CONTAINER_CLASS,
  TAB_CONTENT_CLASS,
  TAB_LIST_CLASS,
} from '@/features/devices/components/device-overview/device-detail-layout-styles'
import { WindowsAppDeploymentsCard } from '@/features/devices/components/WindowsAppDeploymentsCard'
import { WindowsDeviceBitLockerTab } from '@/features/devices/components/WindowsDeviceBitLockerTab'
import { WindowsDeviceInstalledSoftwareTab } from '@/features/devices/components/WindowsDeviceInstalledSoftwareTab'
import { WindowsDeviceLocalUsersTab } from '@/features/devices/components/WindowsDeviceLocalUsersTab'
import { WindowsDeviceServicesTab } from '@/features/devices/components/WindowsDeviceServicesTab'
import { WindowsDeviceActionLogsTab } from '@/features/devices/components/WindowsDeviceActionLogsTab'
import { useDeviceByNumber } from '@/features/devices/hooks/use-device-by-number-query'
import { resolveDeviceOnlineStatusCode } from '@/features/devices/utils/device-online-status'
import { usePeriodicNow } from '@/shared/hooks/use-periodic-now'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { Platform } from '@/shared/api/types/platform'
import { cn } from '@/lib/utils'

interface DeviceDetailPageProps {
  deviceNumber: string
  platform?: Platform
}

export function DeviceDetailPage({ deviceNumber, platform = 'android' }: DeviceDetailPageProps) {
  const { t } = useTranslation()
  const now = usePeriodicNow()
  const [activeTab, setActiveTab] = useState('overview')
  const { data: device, isLoading, error, refetch, isFetching } = useDeviceByNumber(deviceNumber, platform)

  if (isLoading) {
    return <DeviceDetailSkeleton />
  }

  if (error || !device) {
    return (
      <div className={DEVICE_DETAIL_CONTAINER_CLASS}>
        <Card>
          <CardHeader>
            <CardTitle>{t('deviceDetail.notFound')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Link
              to="/devices"
              search={{ platform }}
              className={buttonVariants({ variant: 'outline' })}
            >
              <ArrowLeft className="mr-2 size-4" />
              {t('deviceDetail.backToList')}
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  const onlineStatus = resolveDeviceOnlineStatusCode(device, now)
  const isWindows = device.platform === 'windows'

  return (
    <DeviceDetailCommandToastProvider onGoToActionLogs={() => setActiveTab('action-logs')}>
      <div className={cn(DEVICE_DETAIL_CONTAINER_CLASS, 'space-y-5 pb-8')}>
        <DeviceDetailHeader
          device={device}
          onlineStatus={onlineStatus}
          isFetching={isFetching}
          onRefresh={() => void refetch()}
          onOpenActions={() => setActiveTab('actions')}
        />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-auto w-full space-y-4">
          <TabsList variant="line" className={TAB_LIST_CLASS}>
            <TabsTrigger value="overview">{t('deviceDetail.tabs.overview')}</TabsTrigger>
            <TabsTrigger value="installed-software">{t('deviceDetail.tabs.software')}</TabsTrigger>
            {isWindows ? (
              <TabsTrigger value="local-users">{t('deviceDetail.tabs.users')}</TabsTrigger>
            ) : null}
            {isWindows ? (
              <TabsTrigger value="services">{t('deviceDetail.tabs.services')}</TabsTrigger>
            ) : null}
            {isWindows ? (
              <TabsTrigger value="bitlocker">{t('deviceDetail.tabs.bitlocker')}</TabsTrigger>
            ) : null}
            {isWindows ? (
              <TabsTrigger value="action-logs">{t('deviceDetail.tabs.actionLogs')}</TabsTrigger>
            ) : null}
            <TabsTrigger value="actions">{t('deviceDetail.tabs.actions')}</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className={TAB_CONTENT_CLASS}>
            {isWindows ? (
              <WindowsDeviceOverview device={device} />
            ) : (
              <AndroidDeviceOverview device={device} />
            )}
          </TabsContent>

          <TabsContent value="installed-software" className={TAB_CONTENT_CLASS}>
            {isWindows ? (
              <div className="space-y-4">
                <WindowsAppDeploymentsCard hardwareId={device.number} />
                <WindowsDeviceInstalledSoftwareTab
                  hardwareId={device.number}
                  software={device.installedSoftware ?? []}
                />
              </div>
            ) : (
              <Card className="w-full overflow-visible border-border/80 shadow-none ring-0 dark:border-[#242424] dark:bg-[#111111]">
                <CardContent className="p-0">
                  <table className="w-full min-w-full text-left text-sm">
                    <thead className="border-b border-border/80 bg-muted/40 text-muted-foreground dark:border-[#242424]">
                      <tr>
                        <th className="px-4 py-2.5 font-medium">{t('deviceDetail.software.name')}</th>
                        <th className="px-4 py-2.5 font-medium">{t('deviceDetail.software.version')}</th>
                        <th className="px-4 py-2.5 font-medium">{t('deviceDetail.software.publisher')}</th>
                        <th className="px-4 py-2.5 font-medium">{t('deviceDetail.software.installed')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(device.installedSoftware ?? []).map((app) => (
                        <tr key={`${app.name}-${app.version}`} className="border-b border-border/50 last:border-0 dark:border-[#242424]/80">
                          <td className="px-4 py-2.5 font-medium">{app.name}</td>
                          <td className="px-4 py-2.5 font-mono text-xs">{app.version}</td>
                          <td className="px-4 py-2.5 text-muted-foreground">{app.publisher}</td>
                          <td className="px-4 py-2.5 whitespace-nowrap">{app.installDate}</td>
                        </tr>
                      ))}
                      {(device.installedSoftware ?? []).length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                            {t('deviceDetail.software.empty')}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {isWindows ? (
            <TabsContent value="local-users" className={TAB_CONTENT_CLASS}>
              <WindowsDeviceLocalUsersTab
                hardwareId={device.number}
                localUsers={device.localUsers ?? []}
              />
            </TabsContent>
          ) : null}

          {isWindows ? (
            <TabsContent value="services" className={TAB_CONTENT_CLASS}>
              <WindowsDeviceServicesTab hardwareId={device.number} />
            </TabsContent>
          ) : null}

          {isWindows ? (
            <TabsContent value="bitlocker" className={TAB_CONTENT_CLASS}>
              <WindowsDeviceBitLockerTab device={device} />
            </TabsContent>
          ) : null}

          {isWindows ? (
            <TabsContent value="action-logs" className={TAB_CONTENT_CLASS}>
              <WindowsDeviceActionLogsTab hardwareId={device.number} />
            </TabsContent>
          ) : null}

          <TabsContent value="actions" className={TAB_CONTENT_CLASS}>
            <DeviceActionsPanel device={device} platform={device.platform} />
          </TabsContent>
        </Tabs>
      </div>
    </DeviceDetailCommandToastProvider>
  )
}

function DeviceDetailSkeleton() {
  return (
    <div className={cn(DEVICE_DETAIL_CONTAINER_CLASS, 'space-y-5 pb-8')}>
      <header className="space-y-4 border-b border-border/80 pb-5 dark:border-[#242424]">
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="size-3.5 rounded-full" />
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <Skeleton className="size-11 shrink-0 rounded-lg" />
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Skeleton className="h-7 w-56" />
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="h-3 w-80" />
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-8" />
          </div>
        </div>
      </header>
      <Tabs defaultValue="overview" className="w-full space-y-4">
        <TabsList variant="line" className={TAB_LIST_CLASS}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-24" />
          ))}
        </TabsList>
        <div className="grid gap-5 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-56 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-40 rounded-xl" />
      </Tabs>
    </div>
  )
}
