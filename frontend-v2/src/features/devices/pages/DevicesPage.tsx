import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import { DeviceDeleteDialog } from '@/features/devices/components/DeviceDeleteDialog'
import { DeviceFormDialog } from '@/features/devices/components/DeviceFormDialog'
import { DeviceQrDialog } from '@/features/devices/components/DeviceQrDialog'
import { DeviceRemoteDialog } from '@/features/plugins/deviceremote/components/DeviceRemoteDialog'
import { MessagingSendDialog } from '@/features/plugins/messaging/components/MessagingSendDialog'
import { PushSendDialog } from '@/features/plugins/push/components/PushSendDialog'
import { DeviceTable } from '@/features/devices/components/DeviceTable'
import type { DeviceActionsMenuAction } from '@/features/devices/components/DeviceActionsMenu'
import { DeviceApplicationSettingsDialog } from '@/features/devices/components/DeviceApplicationSettingsDialog'
import { DeviceResetDialog } from '@/features/devices/components/DeviceResetDialog'
import { DeviceLogsDialog } from '@/features/devices/components/DeviceLogsDialog'
import { DeviceInfoDialog } from '@/features/devices/components/DeviceInfoDialog'
import { DeviceInstalledAppsDialog } from '@/features/devices/components/DeviceInstalledAppsDialog'
import { DeviceLocationDialog } from '@/features/devices/components/DeviceLocationDialog'
import { getConfigurationQrCodeKey } from '@/features/devices/api/devices-api'
import { useDevicesQuery } from '@/features/devices/hooks/use-devices-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { isMockApiEnabled } from '@/shared/api/mock-utils'
import { isPlatform } from '@/shared/api/types/platform'
import type { DeviceView } from '@/shared/api/types/device'

const PAGE_SIZE = isMockApiEnabled() ? 5 : 50

interface DevicesPageProps {
  platform: string | undefined
}

export function DevicesPage({ platform: platformParam }: DevicesPageProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const platform = isPlatform(platformParam) ? platformParam : 'android'

  const [pageNum, setPageNum] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [searchValue, setSearchValue] = useState<string | undefined>()

  const [formOpen, setFormOpen] = useState(false)
  const [editingDevice, setEditingDevice] = useState<DeviceView | null>(null)
  const [qrDevice, setQrDevice] = useState<DeviceView | null>(null)
  const [deleteDevice, setDeleteDevice] = useState<DeviceView | null>(null)
  const [menuAction, setMenuAction] = useState<DeviceActionsMenuAction | null>(null)
  const [menuDevice, setMenuDevice] = useState<DeviceView | null>(null)

  useEffect(() => {
    setPageNum(1)
  }, [platform])

  const { data, isLoading, isFetching, error, refetch } = useDevicesQuery({
    platform,
    pageNum,
    pageSize: PAGE_SIZE,
    value: searchValue,
  })

  const totalItems = data?.devices.totalItemsCount ?? 0
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE))

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault()
    setPageNum(1)
    setSearchValue(searchInput.trim() || undefined)
  }

  const handlePlatformChange = (next: 'android' | 'windows') => {
    void navigate({
      to: '/devices',
      search: { platform: next },
    })
  }

  const openAdd = () => {
    setEditingDevice(null)
    setFormOpen(true)
  }

  const openEdit = (device: DeviceView) => {
    setEditingDevice(device)
    setFormOpen(true)
  }

  const closeMenuDialog = () => {
    setMenuAction(null)
    setMenuDevice(null)
  }

  const handleMenuAction = (action: DeviceActionsMenuAction, device: DeviceView) => {
    setMenuAction(action)
    setMenuDevice(device)
  }

  const qrCodeKey =
    qrDevice && data
      ? getConfigurationQrCodeKey(data.configurations, qrDevice.configurationId)
      : undefined

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('devices.title')}</h1>
          <p className="text-sm text-muted-foreground">
            {platform === 'android' ? t('devices.subtitle') : t('devices.subtitleWindows')}
          </p>
        </div>
        <div className="flex rounded-lg border p-1">
          <Button
            type="button"
            size="sm"
            variant={platform === 'android' ? 'default' : 'ghost'}
            onClick={() => handlePlatformChange('android')}
          >
            Android
          </Button>
          <Button
            type="button"
            size="sm"
            variant={platform === 'windows' ? 'default' : 'ghost'}
            onClick={() => handlePlatformChange('windows')}
          >
            Windows
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <form onSubmit={handleSearch} className="flex max-w-xl flex-1 gap-2">
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t('devices.searchPlaceholder')}
          />
          <Button type="submit" variant="secondary">
            {t('devices.search')}
          </Button>
        </form>
        {platform === 'android' && (
          <Button type="button" onClick={openAdd}>
            <Plus className="size-4" />
            {t('devices.add')}
          </Button>
        )}
      </div>

      {error && (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-destructive">{t('devices.errorTitle')}</CardTitle>
            <CardDescription>{t('devices.errorDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button type="button" variant="outline" onClick={() => void refetch()}>
              {t('devices.retry')}
            </Button>
          </CardContent>
        </Card>
      )}

      {data && (
        <>
          <DeviceTable
            data={data}
            platform={platform}
            isLoading={isLoading || isFetching}
            onEditDevice={platform === 'android' ? openEdit : undefined}
            onQrDevice={platform === 'android' ? setQrDevice : undefined}
            onDeleteDevice={platform === 'android' ? setDeleteDevice : undefined}
            onMenuAction={platform === 'android' ? handleMenuAction : undefined}
          />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {t('devices.paginationSummary', {
                from: totalItems === 0 ? 0 : (pageNum - 1) * PAGE_SIZE + 1,
                to: Math.min(pageNum * PAGE_SIZE, totalItems),
                total: totalItems,
              })}
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pageNum <= 1 || isFetching}
                onClick={() => setPageNum((p) => Math.max(1, p - 1))}
              >
                {t('devices.prevPage')}
              </Button>
              <span className="text-sm text-muted-foreground">
                {t('devices.pageOf', { page: pageNum, total: totalPages })}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pageNum >= totalPages || isFetching}
                onClick={() => setPageNum((p) => p + 1)}
              >
                {t('devices.nextPage')}
              </Button>
            </div>
          </div>
        </>
      )}

      <DeviceFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        device={editingDevice}
      />

      <DeviceQrDialog
        open={qrDevice != null}
        onOpenChange={(open) => {
          if (!open) {
            setQrDevice(null)
          }
        }}
        deviceNumber={qrDevice?.number ?? ''}
        deviceName={qrDevice?.description}
        qrCodeKey={qrCodeKey}
      />

      <DeviceApplicationSettingsDialog
        open={menuAction === 'appSettings'}
        onOpenChange={(open) => {
          if (!open) {
            closeMenuDialog()
          }
        }}
        deviceId={menuDevice?.id}
        deviceNumber={menuDevice?.number}
      />

      <DeviceInfoDialog
        open={menuAction === 'details'}
        onOpenChange={(open) => {
          if (!open) {
            closeMenuDialog()
          }
        }}
        deviceNumber={menuDevice?.number}
      />

      <DeviceLogsDialog
        open={menuAction === 'logs'}
        onOpenChange={(open) => {
          if (!open) {
            closeMenuDialog()
          }
        }}
        deviceNumber={menuDevice?.number}
      />

      <MessagingSendDialog
        open={menuAction === 'messaging'}
        onOpenChange={(open) => {
          if (!open) {
            closeMenuDialog()
          }
        }}
        defaultDeviceNumber={menuDevice?.number}
      />

      <PushSendDialog
        open={menuAction === 'push'}
        onOpenChange={(open) => {
          if (!open) {
            closeMenuDialog()
          }
        }}
        defaultDeviceNumber={menuDevice?.number}
      />

      <DeviceResetDialog
        open={menuAction === 'reset'}
        onOpenChange={(open) => {
          if (!open) {
            closeMenuDialog()
          }
        }}
        deviceId={menuDevice?.id}
        deviceNumber={menuDevice?.number}
      />

      <DeviceInstalledAppsDialog
        open={menuAction === 'installedApps'}
        onOpenChange={(open) => {
          if (!open) {
            closeMenuDialog()
          }
        }}
        device={menuDevice}
      />

      <DeviceLocationDialog
        open={menuAction === 'location'}
        onOpenChange={(open) => {
          if (!open) {
            closeMenuDialog()
          }
        }}
        deviceNumber={menuDevice?.number}
      />

      <DeviceRemoteDialog
        open={menuAction === 'remoteControl'}
        onOpenChange={(open) => {
          if (!open) {
            closeMenuDialog()
          }
        }}
        deviceId={menuDevice?.id}
        deviceLabel={menuDevice?.number}
      />

      <DeviceDeleteDialog
        open={deleteDevice != null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteDevice(null)
          }
        }}
        device={deleteDevice}
      />
    </div>
  )
}
