import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertCircle, Loader2 } from 'lucide-react'
import { useDeviceQrCode } from '@/features/devices/hooks/use-device-qr-code'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'

interface DeviceQrDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  deviceNumber: string
  qrCodeKey?: string
}

function QrCallout({ message }: { message: string }) {
  return (
    <div
      className="flex gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-950 dark:text-amber-100"
      role="alert"
    >
      <AlertCircle className="size-5 shrink-0 text-amber-600 dark:text-amber-400" />
      <p>{message}</p>
    </div>
  )
}

export function DeviceQrDialog({
  open,
  onOpenChange,
  deviceNumber,
  qrCodeKey,
}: DeviceQrDialogProps) {
  const { t } = useTranslation()
  const hasQrCodeKey = qrCodeKey != null && qrCodeKey.length > 0

  const { data: blob, isLoading, isError } = useDeviceQrCode(qrCodeKey, deviceNumber, open)

  const [objectUrl, setObjectUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!blob) {
      setObjectUrl(null)
      return undefined
    }

    const url = URL.createObjectURL(blob)
    setObjectUrl(url)

    return () => {
      URL.revokeObjectURL(url)
    }
  }, [blob])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('devices.qr.title')}</DialogTitle>
          <DialogDescription>
            {t('devices.qr.description', { number: deviceNumber })}
          </DialogDescription>
        </DialogHeader>

        {!hasQrCodeKey ? (
          <QrCallout message={t('devices.qr.unavailable')} />
        ) : isLoading ? (
          <div className="flex flex-col items-center gap-3 py-2">
            <Skeleton className="size-64 rounded-lg" />
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {t('devices.qr.loading')}
            </div>
          </div>
        ) : isError || !objectUrl ? (
          <QrCallout message={t('devices.qr.loadError')} />
        ) : (
          <div className="flex justify-center py-2">
            <img
              src={objectUrl}
              alt={t('devices.qr.alt', { number: deviceNumber })}
              className="size-64 rounded-lg border bg-white object-contain p-2"
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
