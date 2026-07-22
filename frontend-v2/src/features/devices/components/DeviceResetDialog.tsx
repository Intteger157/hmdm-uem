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
  requestDevicePasswordReset,
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
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

interface DeviceResetDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  deviceId?: number
  deviceNumber?: string
}

type DeviceAction = 'reboot' | 'lock' | 'unlock' | 'reset' | 'password'

export function DeviceResetDialog({
  open,
  onOpenChange,
  deviceId,
  deviceNumber,
}: DeviceResetDialogProps) {
  const { t } = useTranslation()
  const [lockMessage, setLockMessage] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false)
  const [passwordConfirmOpen, setPasswordConfirmOpen] = useState(false)

  const statusQuery = useQuery({
    queryKey: ['device-reset-status', deviceId],
    queryFn: () => fetchDeviceResetStatus(deviceId!),
    enabled: open && deviceId != null,
  })

  useEffect(() => {
    if (!open) {
      setLockMessage('')
      setNewPassword('')
      setResetConfirmOpen(false)
      setPasswordConfirmOpen(false)
    }
  }, [open])

  const refreshStatus = () => {
    void statusQuery.refetch()
  }

  const runMutation = useMutation({
    mutationFn: async (action: DeviceAction) => {
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
        case 'password': {
          const password = newPassword.trim()
          if (!password) {
            throw new Error('empty-password')
          }
          await requestDevicePasswordReset(deviceId, password)
          break
        }
        default:
          break
      }
    },
    onSuccess: (_data, action) => {
      toast.success(t('devices.reset.success'))
      if (action === 'password') {
        setNewPassword('')
        setPasswordConfirmOpen(false)
      }
      refreshStatus()
    },
    onError: (error) => {
      if (error instanceof Error && error.message === 'empty-password') {
        toast.error(t('devices.reset.passwordRequired'))
        return
      }
      toast.error(t('devices.reset.error'))
    },
  })

  const status = statusQuery.data

  const handlePasswordReset = () => {
    if (!newPassword.trim()) {
      toast.error(t('devices.reset.passwordRequired'))
      return
    }
    setPasswordConfirmOpen(true)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col overflow-hidden sm:max-w-2xl">
          <DialogHeader className="shrink-0">
            <DialogTitle>{t('devices.reset.title')}</DialogTitle>
            <DialogDescription>
              {t('devices.reset.subtitle', { device: deviceNumber ?? '—' })}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
            {(status?.lock || status?.factoryReset || status?.reboot || status?.passwordReset) && (
              <div className="flex flex-wrap gap-2">
                {status.factoryReset && (
                  <span className="rounded-md bg-destructive/10 px-2 py-1 text-xs text-destructive">
                    {t('devices.reset.statusPendingReset')}
                  </span>
                )}
                {status.reboot && (
                  <span className="rounded-md bg-sky-500/10 px-2 py-1 text-xs text-sky-700">
                    {t('devices.reset.statusPendingReboot')}
                  </span>
                )}
                {status.lock && (
                  <span className="rounded-md bg-amber-500/10 px-2 py-1 text-xs text-amber-700">
                    {t('devices.reset.statusLocked')}
                  </span>
                )}
                {status.passwordReset && (
                  <span className="rounded-md bg-primary/10 px-2 py-1 text-xs text-primary">
                    {t('devices.reset.statusPendingPassword')}
                  </span>
                )}
              </div>
            )}

            {status &&
              !status.lock &&
              !status.factoryReset &&
              !status.reboot &&
              !status.passwordReset && (
              <p className="text-sm text-muted-foreground">{t('devices.reset.statusUnlocked')}</p>
            )}

            <div className="grid gap-2">
              <Label htmlFor="lock-message">{t('devices.reset.lockMessage')}</Label>
              <Textarea
                id="lock-message"
                value={lockMessage}
                onChange={(event) => setLockMessage(event.target.value)}
                rows={3}
                maxLength={500}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="device-password">{t('devices.reset.newPassword')}</Label>
              <Input
                id="device-password"
                type="password"
                value={newPassword}
                autoComplete="new-password"
                onChange={(event) => setNewPassword(event.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="shrink-0 flex-wrap gap-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={runMutation.isPending || deviceId == null}
              onClick={() => void runMutation.mutateAsync('reboot')}
            >
              {t('devices.reset.reboot')}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-amber-300 text-amber-800 hover:bg-amber-50"
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
              disabled={runMutation.isPending || deviceId == null}
              onClick={handlePasswordReset}
            >
              {t('devices.reset.resetPassword')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={runMutation.isPending || deviceId == null}
              onClick={() => setResetConfirmOpen(true)}
            >
              {t('devices.reset.factoryReset')}
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

      <ConfirmDeleteDialog
        open={passwordConfirmOpen}
        onOpenChange={setPasswordConfirmOpen}
        title={t('devices.reset.resetPasswordConfirmTitle')}
        description={t('devices.reset.resetPasswordConfirm')}
        confirmLabel={t('devices.reset.resetPassword')}
        confirmVariant="default"
        isPending={runMutation.isPending}
        onConfirm={() => {
          void runMutation.mutateAsync('password')
        }}
      />
    </>
  )
}
