import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { fetchDeviceDetailedInfo } from '@/features/devices/api/device-plugins-api'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface DeviceInfoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  deviceNumber?: string
}

function formatValue(value: unknown): string {
  if (value == null) {
    return '—'
  }
  if (typeof value === 'object') {
    return JSON.stringify(value)
  }
  return String(value)
}

export function DeviceInfoDialog({ open, onOpenChange, deviceNumber }: DeviceInfoDialogProps) {
  const { t } = useTranslation()

  const infoQuery = useQuery({
    queryKey: ['device-detailed-info', deviceNumber],
    queryFn: () => fetchDeviceDetailedInfo(deviceNumber!),
    enabled: open && Boolean(deviceNumber),
  })

  const entries = Object.entries(infoQuery.data ?? {}).filter(
    ([, value]) => value != null && value !== '',
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-hidden sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t('devices.actionsMenu.details')}</DialogTitle>
          <DialogDescription>
            {t('devices.info.subtitle', { device: deviceNumber ?? '—' })}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[55vh] overflow-auto rounded-md border">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 border-b bg-muted/80 backdrop-blur">
              <tr className="text-muted-foreground">
                <th className="px-3 py-2 font-medium">{t('devices.info.columns.field')}</th>
                <th className="px-3 py-2 font-medium">{t('devices.info.columns.value')}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(([key, value]) => (
                <tr key={key} className="border-b last:border-0 align-top">
                  <td className="px-3 py-2 font-medium">{key}</td>
                  <td className="px-3 py-2 break-all font-mono text-xs">{formatValue(value)}</td>
                </tr>
              ))}
              {!infoQuery.isLoading && entries.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-3 py-8 text-center text-muted-foreground">
                    {t('devices.info.empty')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
