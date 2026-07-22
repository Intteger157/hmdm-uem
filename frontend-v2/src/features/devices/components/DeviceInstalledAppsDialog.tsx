import { useMemo } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import {
  fetchDeviceInventory,
  requestDeviceInventoryScan,
} from '@/features/devices/api/device-plugins-api'
import {
  appsFromDeviceInfo,
  mergeInstalledApps,
} from '@/features/devices/utils/installed-apps-utils'
import type { DeviceView } from '@/shared/api/types/device'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface DeviceInstalledAppsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  device?: DeviceView | null
}

function formatTimestamp(value?: number): string {
  if (!value) {
    return '—'
  }
  return new Date(value).toLocaleString()
}

export function DeviceInstalledAppsDialog({
  open,
  onOpenChange,
  device,
}: DeviceInstalledAppsDialogProps) {
  const { t } = useTranslation()
  const deviceNumber = device?.number

  const inventoryQuery = useQuery({
    queryKey: ['device-inventory', deviceNumber],
    queryFn: () => fetchDeviceInventory(deviceNumber!),
    enabled: open && Boolean(deviceNumber),
    retry: false,
  })

  const scanMutation = useMutation({
    mutationFn: () => requestDeviceInventoryScan(deviceNumber!),
    onSuccess: () => {
      toast.success(t('devices.installedApps.scanRequested'))
      void inventoryQuery.refetch()
    },
    onError: () => toast.error(t('devices.installedApps.error')),
  })

  const syncApps = useMemo(
    () => appsFromDeviceInfo(device?.info?.applications),
    [device?.info?.applications]
  )

  const inventoryApps = inventoryQuery.data?.applications ?? []
  const apps = useMemo(
    () => mergeInstalledApps(inventoryApps, syncApps),
    [inventoryApps, syncApps]
  )

  const usingInventory = inventoryApps.length > 0
  const usingSyncFallback = !usingInventory && syncApps.length > 0
  const lastUpdate = usingInventory
    ? inventoryQuery.data?.lastUpdate
    : device?.lastUpdate

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-3xl flex-col overflow-hidden sm:max-w-3xl">
        <DialogHeader className="shrink-0">
          <DialogTitle>{t('devices.actionsMenu.installedApps')}</DialogTitle>
          <DialogDescription>
            {t('devices.installedApps.subtitle', {
              device: deviceNumber ?? '—',
              updated: formatTimestamp(lastUpdate),
            })}
          </DialogDescription>
        </DialogHeader>

        {inventoryQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
        ) : inventoryQuery.error ? (
          <div className="space-y-2 rounded-lg border border-destructive/40 p-4">
            <p className="text-sm text-destructive">{t('devices.installedApps.loadError')}</p>
            {syncApps.length > 0 ? (
              <p className="text-sm text-muted-foreground">
                {t('devices.installedApps.partialHint')}
              </p>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void inventoryQuery.refetch()}
            >
              {t('common.retry')}
            </Button>
          </div>
        ) : null}

        {usingSyncFallback ? (
          <p className="text-sm text-amber-700 dark:text-amber-300">
            {t('devices.installedApps.partialHint')}
          </p>
        ) : null}

        {!inventoryQuery.isLoading &&
        !inventoryQuery.error &&
        apps.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('devices.installedApps.inventoryHint')}</p>
        ) : null}

        <div className="min-h-0 flex-1 overflow-auto rounded-md border">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 border-b bg-muted/80 backdrop-blur">
              <tr className="text-muted-foreground">
                <th className="px-3 py-2 font-medium">{t('devices.installedApps.columns.name')}</th>
                <th className="px-3 py-2 font-medium">{t('devices.installedApps.columns.pkg')}</th>
                <th className="px-3 py-2 font-medium">{t('devices.installedApps.columns.version')}</th>
                <th className="px-3 py-2 font-medium">{t('devices.installedApps.columns.system')}</th>
              </tr>
            </thead>
            <tbody>
              {apps.map((app) => (
                <tr key={`${app.pkg}-${app.version}`} className="border-b last:border-0">
                  <td className="px-3 py-2">{app.name ?? '—'}</td>
                  <td className="px-3 py-2 font-mono text-xs">{app.pkg ?? '—'}</td>
                  <td className="px-3 py-2">{app.version ?? '—'}</td>
                  <td className="px-3 py-2">{app.system ? t('common.yes') : t('common.no')}</td>
                </tr>
              ))}
              {!inventoryQuery.isLoading && apps.length === 0 && !inventoryQuery.error ? (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                    {t('devices.installedApps.empty')}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <DialogFooter className="shrink-0 gap-2 sm:justify-between">
          <Button
            type="button"
            variant="secondary"
            disabled={scanMutation.isPending || !deviceNumber}
            onClick={() => void scanMutation.mutate()}
          >
            {t('devices.installedApps.requestScan')}
          </Button>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
