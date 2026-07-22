import { useTranslation } from 'react-i18next'
import { useDeleteDeviceMutation } from '@/features/devices/hooks/use-device-mutations'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { DeviceView } from '@/shared/api/types/device'
import { toast } from 'sonner'

interface DeviceDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  device: DeviceView | null
}

export function DeviceDeleteDialog({ open, onOpenChange, device }: DeviceDeleteDialogProps) {
  const { t } = useTranslation()
  const deleteMutation = useDeleteDeviceMutation()

  const handleDelete = async () => {
    if (!device) {
      return
    }

    try {
      await deleteMutation.mutateAsync(device.id)
      toast.success(t('devices.delete.success'))
      onOpenChange(false)
    } catch {
      toast.error(t('devices.delete.error'))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('devices.delete.title')}</DialogTitle>
          <DialogDescription>
            {t('devices.delete.confirm', { number: device?.number ?? '' })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="border-t-0 bg-transparent p-0 pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('devices.form.cancel')}
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={deleteMutation.isPending}
            onClick={() => void handleDelete()}
          >
            {deleteMutation.isPending ? t('devices.delete.deleting') : t('devices.delete.action')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
