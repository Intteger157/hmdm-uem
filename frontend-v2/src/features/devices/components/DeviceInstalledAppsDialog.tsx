import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import {
  fetchDeviceInventory,
  requestDeviceInventoryScan,
} from '@/features/devices/api/device-plugins-api'
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
  deviceNumber?: string
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
  deviceNumber,
}: DeviceInstalledAppsDialogProps) {
  const { t } = useTranslation()

  const inventoryQuery = useQuery({
    queryKey: ['device-inventory', deviceNumber],
    queryFn: () => fetchDeviceInventory(deviceNumber!),
    enabled: open && Boolean(deviceNumber),
  })

  const scanMutation = useMutation({
    mutationFn: () => requestDeviceInventoryScan(deviceNumber!),
    onSuccess: () => {
      toast.success(t('devices.installedApps.scanRequested'))
      void inventoryQuery.refetch()
    },
    onError: () => toast.error(t('devices.installedApps.error')),
  })

  const apps = inventoryQuery.data?.applications ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-hidden sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t('devices.actionsMenu.installedApps')}</DialogTitle>
          <DialogDescription>
            {t('devices.installedApps.subtitle', {
              device: deviceNumber ?? '—',
              updated: formatTimestamp(inventoryQuery.data?.lastUpdate),
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[55vh] overflow-auto rounded-md border">
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
              {!inventoryQuery.isLoading && apps.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                    {t('devices.installedApps.empty')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
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
