import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  useDeviceRemoteSettingsQuery,
  useUpdateDeviceRemoteSettingsMutation,
} from '@/features/plugins/deviceremote/hooks/use-deviceremote'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

export function RemoteControlSettingsPage() {
  const { t } = useTranslation()
  const { data, isLoading } = useDeviceRemoteSettingsQuery()
  const updateMutation = useUpdateDeviceRemoteSettingsMutation()
  const [serverUrl, setServerUrl] = useState('')
  const [serverSecret, setServerSecret] = useState('')

  useEffect(() => {
    if (data) {
      setServerUrl(data.serverUrl ?? '')
      setServerSecret(data.serverSecret ?? '')
    }
  }, [data])

  const handleSave = async () => {
    if (!serverUrl.trim()) {
      toast.error(t('plugins.deviceremote.settings.urlRequired'))
      return
    }
    try {
      await updateMutation.mutateAsync({ serverUrl: serverUrl.trim(), serverSecret })
      toast.success(t('plugins.deviceremote.settings.saved'))
    } catch {
      toast.error(t('plugins.deviceremote.settings.error'))
    }
  }

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('nav.remoteControl')}</h1>
        <p className="text-sm text-muted-foreground">{t('plugins.deviceremote.settings.subtitle')}</p>
      </div>
      <Card>
        <CardHeader><CardTitle>{t('plugins.deviceremote.settings.title')}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="remote-server-url">{t('plugins.deviceremote.settings.serverUrl')}</Label>
            <Input id="remote-server-url" value={serverUrl} onChange={(e) => setServerUrl(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="remote-server-secret">{t('plugins.deviceremote.settings.serverSecret')}</Label>
            <Input id="remote-server-secret" value={serverSecret} onChange={(e) => setServerSecret(e.target.value)} autoComplete="off" />
          </div>
          <Button type="button" disabled={updateMutation.isPending} onClick={() => void handleSave()}>
            {t('common.save')}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
