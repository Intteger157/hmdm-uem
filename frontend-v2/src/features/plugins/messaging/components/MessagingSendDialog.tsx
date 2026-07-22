import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useConfigurationsQuery } from '@/features/configurations/hooks/use-configurations'
import { useGroupsQuery } from '@/features/groups/hooks/use-groups'
import { useSendMessagingMutation } from '@/features/plugins/messaging/hooks/use-messaging'
import type { MessagingSendRequest } from '@/features/plugins/messaging/api/messaging-api'
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

interface MessagingSendDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultDeviceNumber?: string
}

export function MessagingSendDialog({
  open,
  onOpenChange,
  defaultDeviceNumber,
}: MessagingSendDialogProps) {
  const { t } = useTranslation()
  const sendMutation = useSendMessagingMutation()
  const groupsQuery = useGroupsQuery()
  const configsQuery = useConfigurationsQuery()

  const [scope, setScope] = useState<MessagingSendRequest['scope']>('device')
  const [deviceNumber, setDeviceNumber] = useState('')
  const [groupId, setGroupId] = useState<number>(0)
  const [configurationId, setConfigurationId] = useState<number>(0)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (open) {
      setScope('device')
      setDeviceNumber(defaultDeviceNumber ?? '')
      setGroupId(0)
      setConfigurationId(0)
      setMessage('')
    }
  }, [open, defaultDeviceNumber])

  const handleSend = async () => {
    if (scope === 'device' && !deviceNumber.trim()) {
      toast.error(t('plugins.messaging.error.emptyDevice'))
      return
    }
    if (scope === 'group' && !groupId) {
      toast.error(t('plugins.messaging.error.emptyGroup'))
      return
    }
    if (scope === 'configuration' && !configurationId) {
      toast.error(t('plugins.messaging.error.emptyConfiguration'))
      return
    }
    if (!message.trim()) {
      toast.error(t('plugins.messaging.error.emptyMessage'))
      return
    }

    try {
      await sendMutation.mutateAsync({
        scope,
        deviceNumber: scope === 'device' ? deviceNumber.trim() : undefined,
        groupId: scope === 'group' ? groupId : undefined,
        configurationId: scope === 'configuration' ? configurationId : undefined,
        message: message.trim(),
      })
      toast.success(t('plugins.messaging.sendSuccess'))
      onOpenChange(false)
    } catch {
      toast.error(t('plugins.messaging.sendError'))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('plugins.messaging.sendTitle')}</DialogTitle>
          <DialogDescription>{t('plugins.messaging.sendDescription')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <FormSelect
            id="messaging-scope"
            label={t('plugins.messaging.scope')}
            value={scope}
            onChange={(v) => setScope(v as MessagingSendRequest['scope'])}
            options={[
              { value: 'device', label: t('plugins.messaging.scopeDevice') },
              { value: 'group', label: t('plugins.messaging.scopeGroup') },
              { value: 'configuration', label: t('plugins.messaging.scopeConfiguration') },
            ]}
          />

          {scope === 'device' && (
            <div className="space-y-2">
              <Label htmlFor="messaging-device">{t('plugins.messaging.columns.device')}</Label>
              <Input id="messaging-device" value={deviceNumber} onChange={(e) => setDeviceNumber(e.target.value)} />
            </div>
          )}

          {scope === 'group' && (
            <FormSelect
              id="messaging-group"
              label={t('plugins.messaging.group')}
              value={groupId}
              onChange={(v) => setGroupId(Number(v))}
              options={(groupsQuery.data ?? []).map((g) => ({ value: g.id ?? 0, label: g.name }))}
            />
          )}

          {scope === 'configuration' && (
            <FormSelect
              id="messaging-config"
              label={t('plugins.messaging.configuration')}
              value={configurationId}
              onChange={(v) => setConfigurationId(Number(v))}
              options={(configsQuery.data ?? []).map((c) => ({ value: c.id ?? 0, label: c.name }))}
            />
          )}

          <div className="space-y-2">
            <Label htmlFor="messaging-text">{t('plugins.messaging.columns.message')}</Label>
            <Input id="messaging-text" value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="button" disabled={sendMutation.isPending} onClick={() => void handleSend()}>
            {t('plugins.messaging.send')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
