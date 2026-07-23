import { useState } from 'react'
import {
  Info,
  KeyRound,
  List,
  MapPin,
  MessageSquare,
  Monitor,
  RefreshCw,
  RotateCcw,
  ScrollText,
  Send,
  Settings2,
  Shield,
  Terminal,
  Trash2,
  Download,
  Lock,
} from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { DeviceApplicationSettingsDialog } from '@/features/devices/components/DeviceApplicationSettingsDialog'
import { DeviceInfoDialog } from '@/features/devices/components/DeviceInfoDialog'
import { DeviceInstalledAppsDialog } from '@/features/devices/components/DeviceInstalledAppsDialog'
import { DeviceLocationDialog } from '@/features/devices/components/DeviceLocationDialog'
import { DeviceLogsDialog } from '@/features/devices/components/DeviceLogsDialog'
import { DeviceResetDialog } from '@/features/devices/components/DeviceResetDialog'
import {
  useDeviceConfigSyncMutation,
  useDeviceFactoryResetMutation,
  useDeviceRebootMutation,
} from '@/features/devices/hooks/use-device-actions'
import { DeviceRemoteDialog } from '@/features/plugins/deviceremote/components/DeviceRemoteDialog'
import { MessagingSendDialog } from '@/features/plugins/messaging/components/MessagingSendDialog'
import { PushSendDialog } from '@/features/plugins/push/components/PushSendDialog'
import type { DeviceView } from '@/shared/api/types/device'
import type { Platform } from '@/shared/api/types/platform'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmDeleteDialog } from '@/shared/components/ConfirmDeleteDialog'
import { useWindowsDeviceCommandMutation } from '@/features/windows/hooks/use-windows-device-command'
import { useQueueWindowsDeviceCommandMutation } from '@/features/windows/hooks/use-queue-windows-device-command'
import { DeployApplicationDialog } from '@/features/devices/components/DeployApplicationDialog'
import { useDeviceAppStatusesQuery } from '@/features/windows/applications/hooks/use-windows-software-apps'
import { WindowsPowerShellDialog } from '@/features/windows/components/WindowsCommandDialogs'
import type { WindowsCommandAction } from '@/features/windows/api/windows-api'
import { waitForWindowsCommandResult } from '@/features/windows/lib/wait-for-command-result'

type AndroidDialogAction =
  | 'appSettings'
  | 'details'
  | 'logs'
  | 'messaging'
  | 'push'
  | 'reset'
  | 'installedApps'
  | 'location'
  | 'remoteControl'

type AndroidCommandAction = 'sync' | 'restart' | 'wipe'

interface AndroidActionDef {
  id: AndroidDialogAction | AndroidCommandAction
  icon: typeof RefreshCw
  labelKey: string
  variant?: 'outline' | 'destructive'
  kind: 'command' | 'dialog'
  requiresConfirm?: boolean
}

interface WindowsActionDef {
  id: WindowsCommandAction
  icon: typeof RefreshCw
  labelKey: string
  variant?: 'outline' | 'destructive'
  requiresConfirm?: boolean
  opensDialog?: 'powershell' | 'catalog'
  descriptionKey?: string
}

const ANDROID_ACTIONS: AndroidActionDef[] = [
  { id: 'sync', icon: RefreshCw, labelKey: 'deviceDetail.actions.sync', kind: 'command' },
  { id: 'restart', icon: RotateCcw, labelKey: 'deviceDetail.actions.restart', kind: 'command' },
  { id: 'messaging', icon: MessageSquare, labelKey: 'devices.actionsMenu.messaging', kind: 'dialog' },
  { id: 'push', icon: Send, labelKey: 'devices.actionsMenu.push', kind: 'dialog' },
  { id: 'remoteControl', icon: Monitor, labelKey: 'devices.actionsMenu.remoteControl', kind: 'dialog' },
  { id: 'details', icon: Info, labelKey: 'devices.actionsMenu.details', kind: 'dialog' },
  { id: 'logs', icon: ScrollText, labelKey: 'devices.actionsMenu.logs', kind: 'dialog' },
  { id: 'installedApps', icon: List, labelKey: 'devices.actionsMenu.installedApps', kind: 'dialog' },
  { id: 'location', icon: MapPin, labelKey: 'devices.actionsMenu.location', kind: 'dialog' },
  { id: 'appSettings', icon: Settings2, labelKey: 'devices.actionsMenu.appSettings', kind: 'dialog' },
  { id: 'reset', icon: KeyRound, labelKey: 'devices.reset.title', kind: 'dialog' },
  {
    id: 'wipe',
    icon: Trash2,
    labelKey: 'deviceDetail.actions.wipe',
    variant: 'destructive',
    kind: 'command',
    requiresConfirm: true,
  },
]

const WINDOWS_ACTIONS: WindowsActionDef[] = [
  { id: 'sync', icon: RefreshCw, labelKey: 'deviceDetail.actions.sync' },
  { id: 'restart', icon: RotateCcw, labelKey: 'deviceDetail.actions.restart', requiresConfirm: true },
  { id: 'lock', icon: Lock, labelKey: 'deviceDetail.actions.lock' },
  { id: 'bitlocker_enable', icon: Shield, labelKey: 'deviceDetail.actions.bitlocker', requiresConfirm: true },
  {
    id: 'install',
    icon: Download,
    labelKey: 'deviceDetail.actions.install',
    opensDialog: 'catalog',
    descriptionKey: 'deviceDetail.actions.installDescription',
  },
  { id: 'powershell', icon: Terminal, labelKey: 'deviceDetail.actions.powershell', opensDialog: 'powershell' },
  { id: 'wipe', icon: Trash2, labelKey: 'deviceDetail.actions.wipe', variant: 'destructive', requiresConfirm: true },
]

interface DeviceActionsPanelProps {
  device: DeviceView
  platform?: Platform
}

export function DeviceActionsPanel({ device, platform = device.platform }: DeviceActionsPanelProps) {
  const { t } = useTranslation()

  const syncMutation = useDeviceConfigSyncMutation()
  const rebootMutation = useDeviceRebootMutation()
  const resetMutation = useDeviceFactoryResetMutation()

  const [activeDialog, setActiveDialog] = useState<AndroidDialogAction | null>(null)
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false)
  const [windowsConfirmAction, setWindowsConfirmAction] = useState<WindowsCommandAction | null>(null)
  const [powershellOpen, setPowershellOpen] = useState(false)
  const [deployAppOpen, setDeployAppOpen] = useState(false)

  const windowsCommandMutation = useWindowsDeviceCommandMutation(device.number)
  const queueLogMutation = useQueueWindowsDeviceCommandMutation(device.number)
  const deviceAppStatusesQuery = useDeviceAppStatusesQuery(device.number, platform === 'windows')
  const assignedAppIds = (deviceAppStatusesQuery.data?.items ?? []).map((item) => item.appId)

  const runAndroidCommand = async (actionId: AndroidCommandAction) => {
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
        case 'wipe':
          setResetConfirmOpen(true)
          break
        default:
          break
      }
    } catch {
      toast.error(t('deviceDetail.actions.error'))
    }
  }

  const handleAndroidAction = (action: AndroidActionDef) => {
    if (action.kind === 'dialog') {
      setActiveDialog(action.id as AndroidDialogAction)
      return
    }
    void runAndroidCommand(action.id as AndroidCommandAction)
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

  const notifyCommandResult = (commandId: number) => {
    void waitForWindowsCommandResult(device.number, commandId).then((result) => {
      if (!result) {
        return
      }
      if (result.success) {
        toast.success(result.message)
      } else {
        toast.error(result.message)
      }
    })
  }

  const queueWindowsCommand = async (
    action: WindowsCommandAction,
    payload?: { script?: string; url?: string },
  ): Promise<boolean> => {
    try {
      const response = await windowsCommandMutation.mutateAsync({ action, payload })
      toast.success(t('deviceDetail.actions.commandQueued'))
      notifyCommandResult(response.id)
      return true
    } catch {
      toast.error(t('deviceDetail.actions.error'))
      return false
    }
  }

  const handleWindowsAction = (action: WindowsActionDef) => {
    if (action.opensDialog === 'powershell') {
      setPowershellOpen(true)
      return
    }
    if (action.opensDialog === 'catalog') {
      setDeployAppOpen(true)
      return
    }
    if (action.requiresConfirm) {
      setWindowsConfirmAction(action.id)
      return
    }
    void queueWindowsCommand(action.id)
  }

  const windowsConfirmLabel = (action: WindowsCommandAction | null) => {
    switch (action) {
      case 'restart':
        return t('deviceDetail.actions.restartConfirm', { device: device.hostname ?? device.number })
      case 'bitlocker_enable':
        return t('deviceDetail.actions.bitlockerConfirm', { device: device.hostname ?? device.number })
      case 'wipe':
        return t('deviceDetail.actions.wipeConfirm', { device: device.hostname ?? device.number })
      default:
        return t('deviceDetail.actions.runConfirm')
    }
  }

  const windowsConfirmTitle = (action: WindowsCommandAction | null) => {
    switch (action) {
      case 'restart':
        return t('deviceDetail.actions.restart')
      case 'bitlocker_enable':
        return t('deviceDetail.actions.bitlocker')
      case 'wipe':
        return t('deviceDetail.actions.wipeConfirmTitle')
      default:
        return t('deviceDetail.actions.run')
    }
  }

  if (platform === 'android') {
    return (
      <>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {ANDROID_ACTIONS.map((action) => {
            const Icon = action.icon
            const label = t(action.labelKey)
            return (
              <Card key={action.id} className="transition-colors hover:bg-muted/30">
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
                    {t('deviceDetail.actions.androidHint')}
                  </CardDescription>
                  <Button
                    type="button"
                    size="sm"
                    variant={action.variant ?? 'outline'}
                    className="mt-3 w-full"
                    disabled={isPending}
                    onClick={() => handleAndroidAction(action)}
                  >
                    {action.kind === 'dialog' ? t('deviceDetail.actions.open') : t('deviceDetail.actions.run')}
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>

        <DeviceApplicationSettingsDialog
          open={activeDialog === 'appSettings'}
          onOpenChange={(open) => setActiveDialog(open ? 'appSettings' : null)}
          deviceId={device.id}
          deviceNumber={device.number}
        />

        <DeviceInfoDialog
          open={activeDialog === 'details'}
          onOpenChange={(open) => setActiveDialog(open ? 'details' : null)}
          deviceNumber={device.number}
        />

        <DeviceLogsDialog
          open={activeDialog === 'logs'}
          onOpenChange={(open) => setActiveDialog(open ? 'logs' : null)}
          deviceNumber={device.number}
        />

        <MessagingSendDialog
          open={activeDialog === 'messaging'}
          onOpenChange={(open) => setActiveDialog(open ? 'messaging' : null)}
          defaultDeviceNumber={device.number}
        />

        <PushSendDialog
          open={activeDialog === 'push'}
          onOpenChange={(open) => setActiveDialog(open ? 'push' : null)}
          defaultDeviceNumber={device.number}
        />

        <DeviceResetDialog
          open={activeDialog === 'reset'}
          onOpenChange={(open) => setActiveDialog(open ? 'reset' : null)}
          deviceId={device.id}
          deviceNumber={device.number}
        />

        <DeviceInstalledAppsDialog
          open={activeDialog === 'installedApps'}
          onOpenChange={(open) => setActiveDialog(open ? 'installedApps' : null)}
          device={device}
        />

        <DeviceLocationDialog
          open={activeDialog === 'location'}
          onOpenChange={(open) => setActiveDialog(open ? 'location' : null)}
          deviceNumber={device.number}
        />

        <DeviceRemoteDialog
          open={activeDialog === 'remoteControl'}
          onOpenChange={(open) => setActiveDialog(open ? 'remoteControl' : null)}
          deviceId={device.id}
          deviceLabel={device.number}
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

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {WINDOWS_ACTIONS.map((action) => {
          const Icon = action.icon
          const label = t(action.labelKey)
          return (
            <Card key={action.id} className="transition-colors hover:bg-muted/30">
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
                  {t(action.descriptionKey ?? 'deviceDetail.actions.windowsHint')}
                </CardDescription>
                <Button
                  type="button"
                  size="sm"
                  variant={action.variant ?? 'outline'}
                  className="mt-3 w-full"
                  disabled={windowsCommandMutation.isPending}
                  onClick={() => handleWindowsAction(action)}
                >
                  {t('deviceDetail.actions.run')}
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <WindowsPowerShellDialog
        open={powershellOpen}
        onOpenChange={setPowershellOpen}
        isPending={queueLogMutation.isPending}
        onSubmit={(script) => {
          void queueLogMutation
            .mutateAsync({ commandName: 'powershell', payload: script })
            .then(() => {
              setPowershellOpen(false)
              toast.success(t('deviceDetail.actions.powershellQueued'))
            })
            .catch(() => {
              toast.error(t('deviceDetail.actions.error'))
            })
        }}
      />

      <ConfirmDeleteDialog
        open={windowsConfirmAction != null}
        onOpenChange={(open) => {
          if (!open) {
            setWindowsConfirmAction(null)
          }
        }}
        title={windowsConfirmTitle(windowsConfirmAction)}
        description={windowsConfirmLabel(windowsConfirmAction)}
        confirmLabel={t('deviceDetail.actions.run')}
        confirmVariant={windowsConfirmAction === 'wipe' ? 'destructive' : 'default'}
        isPending={windowsCommandMutation.isPending}
        onConfirm={() => {
          if (!windowsConfirmAction) {
            return
          }
          const action = windowsConfirmAction
          setWindowsConfirmAction(null)
          void queueWindowsCommand(action)
        }}
      />

      <DeployApplicationDialog
        hardwareId={device.number}
        open={deployAppOpen}
        onOpenChange={setDeployAppOpen}
        assignedAppIds={assignedAppIds}
      />
    </>
  )
}
