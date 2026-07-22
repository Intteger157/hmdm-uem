import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useConfigurationsQuery } from '@/features/configurations/hooks/use-configurations'
import { useGroupsQuery } from '@/features/groups/hooks/use-groups'
import { useSendPushMutation } from '@/features/plugins/push/hooks/use-push'
import type { PushSendRequest } from '@/features/plugins/push/api/push-api'
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
import { Label } from '@/components/ui/label'
import { FormSelect } from '@/shared/components/FormSelect'
import { toast } from 'sonner'

interface PushSendDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultDeviceNumber?: string
}

const MESSAGE_TYPES = [
  'configUpdated',
  'runApp',
  'uninstallApp',
  'deleteFile',
  'deleteDir',
  'purgeDir',
  'permissiveMode',
  'intent',
  'runCommand',
  'reboot',
  'exitKiosk',
  'adminPanel',
  'clearDownloadHistory',
  'grantPermissions',
  'clearAppData',
] as const

const SAMPLE_PAYLOADS: Record<string, string> = {
  configUpdated: '',
  runApp: '{"pkg":"com.example.app"}',
  uninstallApp: '{"pkg":"com.example.app"}',
  deleteFile: '{"path":"/sdcard/file.txt"}',
  deleteDir: '{"path":"/sdcard/folder"}',
  purgeDir: '{"path":"/sdcard/folder"}',
  permissiveMode: '{"enabled":true}',
  intent: '{"action":"android.intent.action.VIEW","data":"https://example.com"}',
  runCommand: '{"command":"echo test"}',
  reboot: '',
  exitKiosk: '',
  adminPanel: '',
  clearDownloadHistory: '',
  grantPermissions: '{"permissions":["android.permission.CAMERA"]}',
  clearAppData: '{"pkg":"com.example.app"}',
}

export function PushSendDialog({ open, onOpenChange, defaultDeviceNumber }: PushSendDialogProps) {
  const { t } = useTranslation()
  const sendMutation = useSendPushMutation()
  const groupsQuery = useGroupsQuery()
  const configsQuery = useConfigurationsQuery()

  const [scope, setScope] = useState<PushSendRequest['scope']>('device')
  const [deviceNumber, setDeviceNumber] = useState('')
  const [groupId, setGroupId] = useState<number>(0)
  const [configurationId, setConfigurationId] = useState<number>(0)
  const [messageType, setMessageType] = useState<string>('configUpdated')
  const [payload, setPayload] = useState('')

  useEffect(() => {
    if (open) {
      setScope('device')
      setDeviceNumber(defaultDeviceNumber ?? '')
      setGroupId(0)
      setConfigurationId(0)
      setMessageType('configUpdated')
      setPayload(SAMPLE_PAYLOADS.configUpdated)
    }
  }, [open, defaultDeviceNumber])

  const handleTypeChange = (type: string) => {
    setMessageType(type)
    setPayload(SAMPLE_PAYLOADS[type] ?? '')
  }

  const handleSend = async () => {
    if (scope === 'device' && !deviceNumber.trim()) {
      toast.error(t('plugins.push.error.emptyDevice'))
      return
    }
    if (scope === 'group' && !groupId) {
      toast.error(t('plugins.push.error.emptyGroup'))
      return
    }
    if (scope === 'configuration' && !configurationId) {
      toast.error(t('plugins.push.error.emptyConfiguration'))
      return
    }

    try {
      await sendMutation.mutateAsync({
        scope,
        deviceNumber: scope === 'device' ? deviceNumber.trim() : undefined,
        groupId: scope === 'group' ? groupId : undefined,
        configurationId: scope === 'configuration' ? configurationId : undefined,
        messageType,
        payload: payload.trim() || undefined,
      })
      toast.success(t('plugins.push.sendSuccess'))
      onOpenChange(false)
    } catch {
      toast.error(t('plugins.push.sendError'))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('plugins.push.sendTitle')}</DialogTitle>
          <DialogDescription>{t('plugins.push.sendDescription')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <FormSelect
            id="push-scope"
            label={t('plugins.push.scope')}
            value={scope}
            onChange={(v) => setScope(v as PushSendRequest['scope'])}
            options={[
              { value: 'device', label: t('plugins.push.scopeDevice') },
              { value: 'group', label: t('plugins.push.scopeGroup') },
              { value: 'configuration', label: t('plugins.push.scopeConfiguration') },
            ]}
          />

          {scope === 'device' && (
            <div className="space-y-2">
              <Label htmlFor="push-device">{t('plugins.push.columns.device')}</Label>
              <Input id="push-device" value={deviceNumber} onChange={(e) => setDeviceNumber(e.target.value)} />
            </div>
          )}

          {scope === 'group' && (
            <FormSelect
              id="push-group"
              label={t('plugins.push.group')}
              value={groupId}
              onChange={(v) => setGroupId(Number(v))}
              options={(groupsQuery.data ?? []).map((g) => ({ value: g.id ?? 0, label: g.name }))}
            />
          )}

          {scope === 'configuration' && (
            <FormSelect
              id="push-config"
              label={t('plugins.push.configuration')}
              value={configurationId}
              onChange={(v) => setConfigurationId(Number(v))}
              options={(configsQuery.data ?? []).map((c) => ({ value: c.id ?? 0, label: c.name }))}
            />
          )}

          <FormSelect
            id="push-type"
            label={t('plugins.push.columns.type')}
            value={messageType}
            onChange={handleTypeChange}
            options={MESSAGE_TYPES.map((type) => ({ value: type, label: type }))}
          />

          <div className="space-y-2">
            <Label htmlFor="push-payload">{t('plugins.push.columns.payload')}</Label>
            <Input id="push-payload" value={payload} onChange={(e) => setPayload(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="button" disabled={sendMutation.isPending} onClick={() => void handleSend()}>
            {t('plugins.push.send')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
