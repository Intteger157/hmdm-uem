import { useState } from 'react'
import {
  MessageSquare,
  RefreshCw,
  RotateCcw,
  Shield,
  Terminal,
  Trash2,
  Download,
  Lock,
} from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import {
  useDeviceConfigSyncMutation,
  useDeviceFactoryResetMutation,
  useDeviceRebootMutation,
} from '@/features/devices/hooks/use-device-actions'
import { MessagingSendDialog } from '@/features/plugins/messaging/components/MessagingSendDialog'
import type { DeviceView } from '@/shared/api/types/device'
import type { Platform } from '@/shared/api/types/platform'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmDeleteDialog } from '@/shared/components/ConfirmDeleteDialog'

interface ActionDef {
  id: string
  icon: typeof RefreshCw
  labelKey: string
  variant?: 'outline' | 'destructive'
  requiresConfirm?: boolean
}

const ANDROID_ACTIONS: ActionDef[] = [
  { id: 'sync', icon: RefreshCw, labelKey: 'deviceDetail.actions.sync' },
  { id: 'restart', icon: RotateCcw, labelKey: 'deviceDetail.actions.restart' },
  { id: 'message', icon: MessageSquare, labelKey: 'deviceDetail.actions.message' },
  { id: 'wipe', icon: Trash2, labelKey: 'deviceDetail.actions.wipe', variant: 'destructive', requiresConfirm: true },
]

const WINDOWS_ACTIONS: ActionDef[] = [
  { id: 'sync', icon: RefreshCw, labelKey: 'deviceDetail.actions.sync' },
  { id: 'restart', icon: RotateCcw, labelKey: 'deviceDetail.actions.restart' },
  { id: 'lock', icon: Lock, labelKey: 'deviceDetail.actions.lock' },
  { id: 'bitlocker', icon: Shield, labelKey: 'deviceDetail.actions.bitlocker' },
  { id: 'install', icon: Download, labelKey: 'deviceDetail.actions.install' },
  { id: 'powershell', icon: Terminal, labelKey: 'deviceDetail.actions.powershell' },
  { id: 'wipe', icon: Trash2, labelKey: 'deviceDetail.actions.wipe', variant: 'destructive' },
]

interface DeviceActionsPanelProps {
  device: DeviceView
  platform?: Platform
}

export function DeviceActionsPanel({ device, platform = device.platform }: DeviceActionsPanelProps) {
  const { t } = useTranslation()
  const actions = platform === 'android' ? ANDROID_ACTIONS : WINDOWS_ACTIONS

  const syncMutation = useDeviceConfigSyncMutation()
  const rebootMutation = useDeviceRebootMutation()
  const resetMutation = useDeviceFactoryResetMutation()

  const [messageOpen, setMessageOpen] = useState(false)
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false)

  const runAndroidAction = async (actionId: string) => {
    try {
      switch (actionId) {
        case 'sync':
          await syncMutation.mutateAsync(device.number)
          toast.success(t('deviceDetail.actions.syncSuccess'))
          break
        case 'restart':
          await rebootMutation.mutateAsync(device.id)
          toast.success(t('deviceDetail.actions.restartSuccess'))
          break
        case 'message':
          setMessageOpen(true)
          return
        case 'wipe':
          setResetConfirmOpen(true)
          return
        default:
          break
      }
    } catch {
      toast.error(t('deviceDetail.actions.error'))
    }
  }

  const runWindowsAction = (_actionId: string, label: string) => {
    toast.info(t('deviceDetail.actions.toast', { action: label }))
  }

  const handleReset = async () => {
    try {
      await resetMutation.mutateAsync(device.id)
      toast.success(t('deviceDetail.actions.wipeSuccess'))
      setResetConfirmOpen(false)
    } catch {
      toast.error(t('deviceDetail.actions.error'))
    }
  }

  const isPending =
    syncMutation.isPending || rebootMutation.isPending || resetMutation.isPending

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {actions.map(({ id, icon: Icon, labelKey, variant = 'outline' }) => {
          const label = t(labelKey)
          return (
            <Card key={id} className="transition-colors hover:bg-muted/30">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <div className="flex size-8 items-center justify-center rounded-md bg-muted">
                    <Icon className="size-4" />
                  </div>
                  <CardTitle className="text-sm font-medium">{label}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <CardDescription className="text-xs">
                  {platform === 'android'
                    ? t('deviceDetail.actions.androidHint')
                    : t('deviceDetail.actions.mockHint')}
                </CardDescription>
                <Button
                  type="button"
                  size="sm"
                  variant={variant}
                  className="mt-3 w-full"
                  disabled={isPending}
                  onClick={() =>
                    platform === 'android'
                      ? void runAndroidAction(id)
                      : runWindowsAction(id, label)
                  }
                >
                  {t('deviceDetail.actions.run')}
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <MessagingSendDialog
        open={messageOpen}
        onOpenChange={setMessageOpen}
        defaultDeviceNumber={device.number}
      />

      <ConfirmDeleteDialog
        open={resetConfirmOpen}
        onOpenChange={setResetConfirmOpen}
        title={t('deviceDetail.actions.wipeConfirmTitle')}
        description={t('deviceDetail.actions.wipeConfirm', { device: device.number })}
        confirmLabel={t('deviceDetail.actions.wipe')}
        confirmVariant="destructive"
        isPending={resetMutation.isPending}
        onConfirm={() => void handleReset()}
      />
    </>
  )
}
