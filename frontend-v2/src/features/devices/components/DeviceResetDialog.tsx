import { useEffect, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import {
  requestDeviceFactoryReset,
  requestDeviceReboot,
} from '@/features/devices/api/device-actions-api'
import {
  fetchDeviceResetStatus,
  requestDeviceLock,
  requestDeviceUnlock,
} from '@/features/devices/api/device-plugins-api'
import { ConfirmDeleteDialog } from '@/shared/components/ConfirmDeleteDialog'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

interface DeviceResetDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  deviceId?: number
  deviceNumber?: string
}

export function DeviceResetDialog({
  open,
  onOpenChange,
  deviceId,
  deviceNumber,
}: DeviceResetDialogProps) {
  const { t } = useTranslation()
  const [lockMessage, setLockMessage] = useState('')
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false)

  const statusQuery = useQuery({
    queryKey: ['device-reset-status', deviceId],
    queryFn: () => fetchDeviceResetStatus(deviceId!),
    enabled: open && deviceId != null,
  })

  useEffect(() => {
    if (!open) {
      setLockMessage('')
    }
  }, [open])

  const refreshStatus = () => {
    void statusQuery.refetch()
  }

  const runMutation = useMutation({
    mutationFn: async (action: 'reboot' | 'lock' | 'unlock' | 'reset') => {
      if (deviceId == null) {
        throw new Error('Missing device id')
      }
      switch (action) {
        case 'reboot':
          await requestDeviceReboot(deviceId)
          break
        case 'lock':
          await requestDeviceLock(deviceId, lockMessage)
          break
        case 'unlock':
          await requestDeviceUnlock(deviceId)
          break
        case 'reset':
          await requestDeviceFactoryReset(deviceId)
          break
        default:
          break
      }
    },
    onSuccess: () => {
      toast.success(t('devices.reset.success'))
      refreshStatus()
    },
    onError: () => toast.error(t('devices.reset.error')),
  })

  const status = statusQuery.data

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('devices.actionsMenu.reset')}</DialogTitle>
            <DialogDescription>
              {t('devices.reset.subtitle', { device: deviceNumber ?? '—' })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {status?.locked != null && (
              <p className="text-sm text-muted-foreground">
                {status.locked
                  ? t('devices.reset.statusLocked')
                  : t('devices.reset.statusUnlocked')}
              </p>
            )}

            <div className="grid gap-2">
              <Label htmlFor="lock-message">{t('devices.reset.lockMessage')}</Label>
              <Textarea
                id="lock-message"
                value={lockMessage}
                onChange={(event) => setLockMessage(event.target.value)}
                rows={3}
              />
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                type="button"
                variant="outline"
                disabled={runMutation.isPending || deviceId == null}
                onClick={() => void runMutation.mutateAsync('reboot')}
              >
                {t('devices.reset.reboot')}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={runMutation.isPending || deviceId == null}
                onClick={() => void runMutation.mutateAsync('lock')}
              >
                {t('devices.reset.lock')}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={runMutation.isPending || deviceId == null}
                onClick={() => void runMutation.mutateAsync('unlock')}
              >
                {t('devices.reset.unlock')}
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={runMutation.isPending || deviceId == null}
                onClick={() => setResetConfirmOpen(true)}
              >
                {t('devices.reset.factoryReset')}
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={resetConfirmOpen}
        onOpenChange={setResetConfirmOpen}
        title={t('devices.reset.factoryResetConfirmTitle')}
        description={t('devices.reset.factoryResetConfirm', { device: deviceNumber ?? '—' })}
        confirmLabel={t('devices.reset.factoryReset')}
        confirmVariant="destructive"
        isPending={runMutation.isPending}
        onConfirm={() => {
          void runMutation.mutateAsync('reset').finally(() => setResetConfirmOpen(false))
        }}
      />
    </>
  )
}
