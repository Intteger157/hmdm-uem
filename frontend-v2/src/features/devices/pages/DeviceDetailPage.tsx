import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, ChevronRight } from 'lucide-react'
import { DeviceActionsPanel } from '@/features/devices/components/DeviceActionsPanel'
import { useDeviceQuery } from '@/features/devices/hooks/use-device-query'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress, ProgressLabel, ProgressValue } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { DeviceView } from '@/shared/api/types/device'
import { cn } from '@/lib/utils'
import { useState } from 'react'

const STATUS_BADGE: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  green: 'default',
  yellow: 'outline',
  red: 'destructive',
  brown: 'secondary',
  grey: 'secondary',
}

function formatTimestamp(ms?: number): string {
  if (!ms) return '—'
  return new Date(ms).toLocaleString()
}

function deviceTitle(device: DeviceView): string {
  return device.description ?? device.hostname ?? device.number
}

function deviceIdentifier(device: DeviceView): string {
  return device.platform === 'windows'
    ? (device.hostname ?? device.number)
    : device.number
}

interface DeviceDetailPageProps {
  deviceId: string
}

export function DeviceDetailPage({ deviceId }: DeviceDetailPageProps) {
  const { t } = useTranslation()
  const id = Number(deviceId)
  const { data: device, isLoading, error } = useDeviceQuery(id)
  const [activeTab, setActiveTab] = useState('software')

  if (isLoading) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
        {t('deviceDetail.loading')}
      </div>
    )
  }

  if (error || !device) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('deviceDetail.notFound')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Link
            to="/devices"
            search={{ platform: 'android' }}
            className={buttonVariants({ variant: 'outline' })}
          >
            <ArrowLeft className="mr-2 size-4" />
            {t('deviceDetail.backToList')}
          </Link>
        </CardContent>
      </Card>
    )
  }

  const diskPercent =
    device.diskTotalGb && device.diskUsedGb != null
      ? Math.round((device.diskUsedGb / device.diskTotalGb) * 100)
      : undefined

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link to="/devices" search={{ platform: device.platform }} className="hover:text-foreground">
          {t('nav.devices')}
        </Link>
        <ChevronRight className="size-3.5" />
        <span className="text-foreground">{deviceIdentifier(device)}</span>
      </div>

      <div className="flex flex-col gap-4 border-b pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">{deviceTitle(device)}</h1>
            <Badge variant={STATUS_BADGE[device.statusCode ?? 'grey'] ?? 'secondary'}>
              {device.statusCode ?? 'unknown'}
            </Badge>
            <Badge variant="outline">{device.platform}</Badge>
            {device.kioskMode && <Badge variant="secondary">Kiosk</Badge>}
          </div>
          <p className="font-mono text-sm text-muted-foreground">{deviceIdentifier(device)}</p>
        </div>
        <Button type="button" onClick={() => setActiveTab('actions')}>
          {t('deviceDetail.deviceActions')}
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        <MetricCard label={t('deviceDetail.metrics.serial')} value={device.serialNumber ?? '—'} mono />
        <MetricCard label={t('deviceDetail.metrics.manufacturer')} value={device.manufacturer ?? '—'} />
        <MetricCard label={t('deviceDetail.metrics.model')} value={device.model ?? device.info?.model ?? '—'} />
        <MetricCard label={t('deviceDetail.metrics.lastOnline')} value={formatTimestamp(device.lastUpdate)} />
        <MetricCard label={t('deviceDetail.metrics.currentUser')} value={device.currentUser ?? '—'} mono />
        {device.platform === 'windows' && (
          <>
            <MetricCard label={t('deviceDetail.metrics.cpu')} value={device.cpu ?? '—'} />
            <MetricCard
              label={t('deviceDetail.metrics.ram')}
              value={device.ramGb != null ? `${device.ramGb} GB` : '—'}
            />
            <Card className="sm:col-span-2">
              <CardHeader className="px-4 py-3 pb-1">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  {t('deviceDetail.metrics.disk')}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3 pt-0">
                {diskPercent != null ? (
                  <Progress value={diskPercent}>
                    <ProgressLabel className="text-xs">
                      {device.diskUsedGb} / {device.diskTotalGb} GB
                    </ProgressLabel>
                    <ProgressValue />
                  </Progress>
                ) : (
                  <span className="text-sm">—</span>
                )}
              </CardContent>
            </Card>
            <MetricCard
              label={t('deviceDetail.metrics.encryption')}
              value={
                device.diskEncrypted
                  ? t('deviceDetail.encrypted')
                  : t('deviceDetail.notEncrypted')
              }
            />
          </>
        )}
        {device.platform === 'android' && (
          <>
            <MetricCard
              label={t('devices.columns.androidVersion')}
              value={device.androidVersion ?? '—'}
            />
            <MetricCard
              label={t('devices.columns.battery')}
              value={
                device.info?.batteryLevel != null ? `${device.info.batteryLevel}%` : '—'
              }
            />
            <MetricCard label={t('devices.columns.imei')} value={device.imei ?? '—'} mono />
          </>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList variant="line">
          <TabsTrigger value="software">{t('deviceDetail.tabs.software')}</TabsTrigger>
          <TabsTrigger value="users">{t('deviceDetail.tabs.users')}</TabsTrigger>
          <TabsTrigger value="actions">{t('deviceDetail.tabs.actions')}</TabsTrigger>
        </TabsList>

        <TabsContent value="software" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="max-h-80 overflow-auto">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 border-b bg-muted/80 backdrop-blur">
                    <tr className="text-muted-foreground">
                      <th className="px-4 py-2.5 font-medium">{t('deviceDetail.software.name')}</th>
                      <th className="px-4 py-2.5 font-medium">{t('deviceDetail.software.version')}</th>
                      <th className="px-4 py-2.5 font-medium">{t('deviceDetail.software.publisher')}</th>
                      <th className="px-4 py-2.5 font-medium">{t('deviceDetail.software.installed')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(device.installedSoftware ?? []).map((app) => (
                      <tr key={`${app.name}-${app.version}`} className="border-b last:border-0">
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
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">{t('deviceDetail.users.username')}</th>
                    <th className="px-4 py-2.5 font-medium">{t('deviceDetail.users.admin')}</th>
                    <th className="px-4 py-2.5 font-medium">{t('deviceDetail.users.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(device.localUsers ?? []).map((user) => (
                    <tr key={user.username} className="border-b last:border-0">
                      <td className="px-4 py-2.5 font-mono text-xs">{user.username}</td>
                      <td className="px-4 py-2.5">
                        {user.isAdmin ? t('deviceDetail.users.yes') : t('deviceDetail.users.no')}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge
                          variant={
                            user.status === 'active'
                              ? 'default'
                              : user.status === 'locked'
                                ? 'destructive'
                                : 'secondary'
                          }
                        >
                          {user.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                  {(device.localUsers ?? []).length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">
                        {t('deviceDetail.users.empty')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="actions" className="mt-4">
          <DeviceActionsPanel />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function MetricCard({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <Card>
      <CardHeader className="px-4 py-3 pb-1">
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className={cn('px-4 pb-3 pt-0 text-sm font-medium', mono && 'font-mono text-xs')}>
        {value}
      </CardContent>
    </Card>
  )
}
