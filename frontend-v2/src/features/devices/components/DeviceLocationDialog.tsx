import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { fetchDeviceLocation } from '@/features/devices/api/device-plugins-api'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface DeviceLocationDialogProps {
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

function formatCoordinates(lat?: number, lon?: number): string {
  if (lat == null || lon == null) {
    return '—'
  }
  return `${lat.toFixed(6)}, ${lon.toFixed(6)}`
}

export function DeviceLocationDialog({ open, onOpenChange, deviceNumber }: DeviceLocationDialogProps) {
  const { t } = useTranslation()

  const locationQuery = useQuery({
    queryKey: ['device-location', deviceNumber],
    queryFn: () => fetchDeviceLocation(deviceNumber!),
    enabled: open && Boolean(deviceNumber),
  })

  const location = locationQuery.data
  const history = location?.history ?? []
  const mapsUrl =
    location?.lat != null && location?.lon != null
      ? `https://www.google.com/maps?q=${location.lat},${location.lon}`
      : undefined

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-hidden sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t('devices.actionsMenu.location')}</DialogTitle>
          <DialogDescription>
            {t('devices.location.subtitle', { device: deviceNumber ?? '—' })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border p-4 text-sm">
            <p>
              <span className="font-medium">{t('devices.location.latest')}:</span>{' '}
              {formatCoordinates(location?.lat, location?.lon)}
            </p>
            <p className="mt-1 text-muted-foreground">
              {t('devices.location.updatedAt', { time: formatTimestamp(location?.ts) })}
            </p>
            {location?.source && (
              <p className="mt-1 text-muted-foreground">
                {t('devices.location.source', { source: location.source })}
              </p>
            )}
            {mapsUrl && (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block text-sm text-primary hover:underline"
              >
                {t('devices.location.openMap')}
              </a>
            )}
          </div>

          <div className="max-h-[40vh] overflow-auto rounded-md border">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 border-b bg-muted/80 backdrop-blur">
                <tr className="text-muted-foreground">
                  <th className="px-3 py-2 font-medium">{t('devices.location.columns.time')}</th>
                  <th className="px-3 py-2 font-medium">{t('devices.location.columns.coordinates')}</th>
                  <th className="px-3 py-2 font-medium">{t('devices.location.columns.source')}</th>
                </tr>
              </thead>
              <tbody>
                {history.map((point, index) => (
                  <tr key={`${point.ts}-${index}`} className="border-b last:border-0">
                    <td className="px-3 py-2 whitespace-nowrap">{formatTimestamp(point.ts)}</td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {formatCoordinates(point.lat, point.lon)}
                    </td>
                    <td className="px-3 py-2">{point.source ?? '—'}</td>
                  </tr>
                ))}
                {!locationQuery.isLoading && history.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-3 py-8 text-center text-muted-foreground">
                      {t('devices.location.emptyHistory')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
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
