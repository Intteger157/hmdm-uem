import { useTranslation } from 'react-i18next'
import { buildDeviceQrCodeImageUrl } from '@/features/devices/api/devices-api'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface DeviceQrDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  deviceNumber: string
  qrCodeKey?: string
}

export function DeviceQrDialog({
  open,
  onOpenChange,
  deviceNumber,
  qrCodeKey,
}: DeviceQrDialogProps) {
  const { t } = useTranslation()

  const imageUrl =
    qrCodeKey != null ? buildDeviceQrCodeImageUrl(qrCodeKey, deviceNumber) : undefined

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('devices.qr.title')}</DialogTitle>
          <DialogDescription>
            {t('devices.qr.description', { number: deviceNumber })}
          </DialogDescription>
        </DialogHeader>

        {imageUrl ? (
          <div className="flex justify-center py-2">
            <img
              src={imageUrl}
              alt={t('devices.qr.alt', { number: deviceNumber })}
              className="size-64 rounded-lg border bg-white object-contain p-2"
            />
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t('devices.qr.unavailable')}
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}
