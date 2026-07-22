import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { searchDeviceLogs } from '@/features/devices/api/device-plugins-api'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface DeviceLogsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  deviceNumber?: string
}

function formatLogTime(value?: number): string {
  if (!value) {
    return '—'
  }
  return new Date(value).toLocaleString()
}

export function DeviceLogsDialog({ open, onOpenChange, deviceNumber }: DeviceLogsDialogProps) {
  const { t } = useTranslation()

  const logsQuery = useQuery({
    queryKey: ['device-logs', deviceNumber],
    queryFn: () => searchDeviceLogs(deviceNumber!),
    enabled: open && Boolean(deviceNumber),
  })

  const records = logsQuery.data?.items ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-4xl overflow-hidden sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{t('devices.actionsMenu.logs')}</DialogTitle>
          <DialogDescription>
            {t('devices.logs.subtitle', { device: deviceNumber ?? '—' })}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[55vh] overflow-auto rounded-md border">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 border-b bg-muted/80 backdrop-blur">
              <tr className="text-muted-foreground">
                <th className="px-3 py-2 font-medium">{t('devices.logs.columns.time')}</th>
                <th className="px-3 py-2 font-medium">{t('devices.logs.columns.pkg')}</th>
                <th className="px-3 py-2 font-medium">{t('devices.logs.columns.severity')}</th>
                <th className="px-3 py-2 font-medium">{t('devices.logs.columns.message')}</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record, index) => (
                <tr key={`${record.createTime}-${index}`} className="border-b last:border-0 align-top">
                  <td className="px-3 py-2 whitespace-nowrap">{formatLogTime(record.createTime)}</td>
                  <td className="px-3 py-2 font-mono text-xs">{record.applicationPkg ?? '—'}</td>
                  <td className="px-3 py-2">{record.severity ?? '—'}</td>
                  <td className="px-3 py-2">{record.message ?? '—'}</td>
                </tr>
              ))}
              {!logsQuery.isLoading && records.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                    {t('devices.logs.empty')}
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
