import { useState } from 'react'
import {
  FolderOpen,
  Info,
  KeyRound,
  List,
  ListTree,
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
  Zap,
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
import { DeployApplicationDialog } from '@/features/devices/components/DeployApplicationDialog'
import {
  useDeviceAppStatusesQuery,
  useSoftwareAppsQuery,
} from '@/features/windows/applications/hooks/use-windows-software-apps'
import { DeviceTerminalDialog } from '@/features/windows/components/DeviceTerminalDialog'
import { DeviceTaskManagerDialog } from '@/features/windows/components/DeviceTaskManagerDialog'
import { DeviceFileExplorerDialog } from '@/features/windows/components/DeviceFileExplorerDialog'
import { useDeviceDetailCommandToast } from '@/features/devices/context/device-detail-command-toast-context'
import type { WindowsCommandAction } from '@/features/windows/api/windows-api'
import { usePermissions } from '@/features/auth/hooks/use-permissions'
import type { AccessLevel } from '@/shared/lib/access-level'

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
  /**
   * Least access level allowed to use this card. Defaults to the Operator level
   * because a card that changes nothing is the exception here, not the rule.
   */
  minLevel?: AccessLevel
}

type WindowsPanelActionId = WindowsCommandAction | 'task_manager' | 'file_explorer'

function isWindowsCommandAction(id: WindowsPanelActionId): id is WindowsCommandAction {
  return id !== 'task_manager' && id !== 'file_explorer'
}

interface WindowsActionDef {
  id: WindowsPanelActionId
  icon: typeof RefreshCw
  labelKey: string
  variant?: 'outline' | 'destructive'
  requiresConfirm?: boolean
  opensDialog?: 'terminal' | 'catalog' | 'taskmgr' | 'filexplorer'
  descriptionKey?: string
  /** See AndroidActionDef.minLevel. */
  minLevel?: AccessLevel
}

const ANDROID_ACTIONS: AndroidActionDef[] = [
  { id: 'sync', icon: RefreshCw, labelKey: 'deviceDetail.actions.sync', kind: 'command' },
  { id: 'restart', icon: RotateCcw, labelKey: 'deviceDetail.actions.restart', kind: 'command' },
  { id: 'messaging', icon: MessageSquare, labelKey: 'devices.actionsMenu.messaging', kind: 'dialog' },
  { id: 'push', icon: Send, labelKey: 'devices.actionsMenu.push', kind: 'dialog' },
  // The Android counterpart of the Windows live terminal: it hands over the
  // screen rather than editing a record about the device.
  {
    id: 'remoteControl',
    icon: Monitor,
    labelKey: 'devices.actionsMenu.remoteControl',
    kind: 'dialog',
    minLevel: 'high',
  },
  // Read-only dialogs, so an Observer keeps a use for this tab.
  { id: 'details', icon: Info, labelKey: 'devices.actionsMenu.details', kind: 'dialog', minLevel: 'low' },
  { id: 'logs', icon: ScrollText, labelKey: 'devices.actionsMenu.logs', kind: 'dialog', minLevel: 'low' },
  {
    id: 'installedApps',
    icon: List,
    labelKey: 'devices.actionsMenu.installedApps',
    kind: 'dialog',
    minLevel: 'low',
  },
  { id: 'location', icon: MapPin, labelKey: 'devices.actionsMenu.location', kind: 'dialog', minLevel: 'low' },
  { id: 'appSettings', icon: Settings2, labelKey: 'devices.actionsMenu.appSettings', kind: 'dialog' },
  // Reboot and lock are routine; the factory reset inside is gated separately.
  { id: 'reset', icon: KeyRound, labelKey: 'devices.reset.title', kind: 'dialog' },
  {
    id: 'wipe',
    icon: Trash2,
    labelKey: 'deviceDetail.actions.wipe',
    variant: 'destructive',
    kind: 'command',
    requiresConfirm: true,
    minLevel: 'high',
  },
]

const WINDOWS_ACTIONS: WindowsActionDef[] = [
  { id: 'sync', icon: RefreshCw, labelKey: 'deviceDetail.actions.sync' },
  {
    id: 'apply_configuration',
    icon: Zap,
    labelKey: 'deviceDetail.actions.applyConfiguration',
    descriptionKey: 'deviceDetail.actions.applyConfigurationDescription',
  },
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
  // The three relays below each open a live session on the machine — a shell, a
  // process list that can kill, a file browser that can upload and execute — so
  // they sit with wipe rather than with the routine commands above. The Go
  // service refuses the handshake at anything below this level.
  {
    id: 'powershell',
    icon: Terminal,
    labelKey: 'deviceDetail.terminal.title',
    opensDialog: 'terminal',
    descriptionKey: 'deviceDetail.terminal.description',
    minLevel: 'high',
  },
  {
    id: 'task_manager',
    icon: ListTree,
    labelKey: 'deviceDetail.taskManager.title',
    opensDialog: 'taskmgr',
    descriptionKey: 'deviceDetail.taskManager.description',
    minLevel: 'high',
  },
  {
    id: 'file_explorer',
    icon: FolderOpen,
    labelKey: 'deviceDetail.fileExplorer.title',
    opensDialog: 'filexplorer',
    descriptionKey: 'deviceDetail.fileExplorer.description',
    minLevel: 'high',
  },
  {
    id: 'wipe',
    icon: Trash2,
    labelKey: 'deviceDetail.actions.wipe',
    variant: 'destructive',
    requiresConfirm: true,
    minLevel: 'high',
  },
]

interface DeviceActionsPanelProps {
  device: DeviceView
  platform?: Platform
}

export function DeviceActionsPanel({ device, platform = device.platform }: DeviceActionsPanelProps) {
  const { t } = useTranslation()
  const { atLeast } = usePermissions()
  const allowsAction = (action: { minLevel?: AccessLevel }) => atLeast(action.minLevel ?? 'mid')

  const syncMutation = useDeviceConfigSyncMutation()
  const rebootMutation = useDeviceRebootMutation()
  const resetMutation = useDeviceFactoryResetMutation()

  const [activeDialog, setActiveDialog] = useState<AndroidDialogAction | null>(null)
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false)
  const [windowsConfirmAction, setWindowsConfirmAction] = useState<WindowsCommandAction | null>(null)
  const [terminalOpen, setTerminalOpen] = useState(false)
  const [taskManagerOpen, setTaskManagerOpen] = useState(false)
  const [fileExplorerOpen, setFileExplorerOpen] = useState(false)
  const [deployAppOpen, setDeployAppOpen] = useState(false)

  const windowsCommandMutation = useWindowsDeviceCommandMutation(device.number)
  const { trackPollCommand, trackActionLogCommand } = useDeviceDetailCommandToast()
  const deviceAppStatusesQuery = useDeviceAppStatusesQuery(device.number, platform === 'windows')
  const deviceAppStatuses = deviceAppStatusesQuery.data?.items ?? []
  useSoftwareAppsQuery(platform === 'windows')

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

  const queueWindowsCommand = async (
    action: WindowsCommandAction,
    payload?: { script?: string; url?: string },
  ): Promise<boolean> => {
    try {
      const response = await windowsCommandMutation.mutateAsync({ action, payload })
      if (response.logId) {
        trackActionLogCommand(device.number, response.logId)
      } else {
        trackPollCommand(device.number, response.id)
      }
      return true
    } catch {
      toast.error(t('deviceDetail.actions.error'))
      return false
    }
  }

  const handleWindowsAction = (action: WindowsActionDef) => {
    if (action.opensDialog === 'terminal') {
      setTerminalOpen(true)
      return
    }
    if (action.opensDialog === 'taskmgr') {
      setTaskManagerOpen(true)
      return
    }
    if (action.opensDialog === 'filexplorer') {
      setFileExplorerOpen(true)
      return
    }
    if (action.opensDialog === 'catalog') {
      setDeployAppOpen(true)
      return
    }
    if (action.requiresConfirm) {
      if (isWindowsCommandAction(action.id)) {
        setWindowsConfirmAction(action.id)
      }
      return
    }
    if (isWindowsCommandAction(action.id)) {
      void queueWindowsCommand(action.id)
    }
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
          {ANDROID_ACTIONS.filter(allowsAction).map((action) => {
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
        {WINDOWS_ACTIONS.filter(allowsAction).map((action) => {
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

      <DeviceTerminalDialog
        open={terminalOpen}
        onOpenChange={setTerminalOpen}
        hardwareId={device.number}
      />

      <DeviceTaskManagerDialog
        open={taskManagerOpen}
        onOpenChange={setTaskManagerOpen}
        hardwareId={device.number}
      />

      <DeviceFileExplorerDialog
        open={fileExplorerOpen}
        onOpenChange={setFileExplorerOpen}
        hardwareId={device.number}
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
        deviceAppStatuses={deviceAppStatuses}
      />
    </>
  )
}
