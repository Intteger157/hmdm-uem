import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertCircle, Copy, Loader2 } from 'lucide-react'
import { buildDeviceQrCodePublicUrl } from '@/features/devices/api/devices-api'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'

interface DeviceQrDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  deviceNumber: string
  qrCodeKey?: string
}

type QrImageState = 'idle' | 'loading' | 'loaded' | 'error'

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

  const imageUrl = hasQrCodeKey
    ? buildDeviceQrCodePublicUrl(qrCodeKey, deviceNumber, { size: 280 })
    : undefined

  const [imageState, setImageState] = useState<QrImageState>('idle')

  useEffect(() => {
    if (!open || !imageUrl) {
      setImageState('idle')
      return
    }

    setImageState('loading')

    const probe = new Image()
    probe.onload = () => {
      setImageState(probe.naturalWidth > 0 ? 'loaded' : 'error')
    }
    probe.onerror = () => {
      setImageState('error')
    }
    probe.src = imageUrl

    return () => {
      probe.onload = null
      probe.onerror = null
    }
  }, [open, imageUrl])

  const handleCopyLink = async () => {
    if (!qrCodeKey) {
      return
    }

    try {
      const url = buildDeviceQrCodePublicUrl(qrCodeKey, deviceNumber, { size: 280 })
      await navigator.clipboard.writeText(url)
      toast.success(t('devices.qr.linkCopied'))
    } catch {
      toast.error(t('devices.qr.linkCopyError'))
    }
  }

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
          <QrCallout message={t('devices.qr.loadError')} />
        ) : imageState === 'loading' ? (
          <div className="flex flex-col items-center gap-3 py-2">
            <Skeleton className="size-64 rounded-lg" />
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {t('devices.qr.loading')}
            </div>
          </div>
        ) : imageState === 'error' ? (
          <div className="space-y-3">
            <QrCallout message={t('devices.qr.loadError')} />
            <div className="flex justify-center">
              <Button type="button" variant="outline" size="sm" onClick={() => void handleCopyLink()}>
                <Copy className="size-4" />
                {t('devices.qr.copyLink')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-2">
            <img
              src={imageUrl}
              alt={t('devices.qr.alt', { number: deviceNumber })}
              className="size-64 rounded-lg border bg-white object-contain p-2"
            />
            <Button type="button" variant="outline" size="sm" onClick={() => void handleCopyLink()}>
              <Copy className="size-4" />
              {t('devices.qr.copyLink')}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
