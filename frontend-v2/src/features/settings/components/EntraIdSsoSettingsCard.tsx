import { useEffect, useMemo, useState } from 'react'
import { Copy } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  fetchEntraIdSsoSettings,
  getSsoSettingsErrorMessage,
  saveEntraIdSsoSettings,
  type EntraIdSsoSettings,
} from '@/features/settings/api/sso-settings-api'
import { buildMicrosoftSsoRedirectUri } from '@/features/settings/lib/microsoft-redirect-uri'
import { copyTextToClipboard } from '@/shared/lib/copy-to-clipboard'

const defaultDraft: EntraIdSsoSettings = {
  enabled: false,
  tenantId: '',
  clientId: '',
  clientSecret: '',
}

export function EntraIdSsoSettingsCard() {
  const { t } = useTranslation()
  const [draft, setDraft] = useState<EntraIdSsoSettings>(defaultDraft)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const redirectUri = useMemo(() => buildMicrosoftSsoRedirectUri(), [])

  useEffect(() => {
    let cancelled = false

    async function loadSettings() {
      setLoading(true)
      try {
        const settings = await fetchEntraIdSsoSettings()
        if (!cancelled) {
          setDraft(settings)
        }
      } catch (error) {
        if (!cancelled) {
          const detail = getSsoSettingsErrorMessage(error)
          toast.error(detail ?? t('settings.sso.loadError'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadSettings()

    return () => {
      cancelled = true
    }
  }, [t])

  const update = (patch: Partial<EntraIdSsoSettings>) => {
    setDraft((current) => ({ ...current, ...patch }))
  }

  const handleCopyRedirectUri = async () => {
    try {
      await copyTextToClipboard(redirectUri)
      toast.success(t('settings.sso.redirectUriCopied'))
    } catch {
      toast.error(t('settings.sso.redirectUriCopyError'))
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const saved = await saveEntraIdSsoSettings(draft)
      setDraft(saved)
      toast.success(t('settings.sso.saved'))
    } catch (error) {
      const detail = getSsoSettingsErrorMessage(error)
      toast.error(detail ?? t('settings.sso.saveError'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.sso.entraTitle')}</CardTitle>
        <CardDescription>{t('settings.sso.entraDescription')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-start justify-between gap-4 rounded-lg border border-border px-3 py-3">
          <div className="min-w-0 space-y-1">
            <Label htmlFor="sso-entra-enabled" className="text-sm font-medium">
              {t('settings.sso.enableLabel')}
            </Label>
            <p className="text-xs text-muted-foreground">{t('settings.sso.enableHint')}</p>
          </div>
          <Switch
            id="sso-entra-enabled"
            checked={draft.enabled}
            onCheckedChange={(checked) => update({ enabled: checked })}
            className="mt-0.5 shrink-0"
            disabled={loading}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="sso-tenant-id">{t('settings.sso.tenantId')}</Label>
            <Input
              id="sso-tenant-id"
              value={draft.tenantId}
              onChange={(e) => update({ tenantId: e.target.value })}
              placeholder="00000000-0000-0000-0000-000000000000"
              autoComplete="off"
              disabled={loading || !draft.enabled}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="sso-client-id">{t('settings.sso.clientId')}</Label>
            <Input
              id="sso-client-id"
              value={draft.clientId}
              onChange={(e) => update({ clientId: e.target.value })}
              placeholder="00000000-0000-0000-0000-000000000000"
              autoComplete="off"
              disabled={loading || !draft.enabled}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="sso-client-secret">{t('settings.sso.clientSecret')}</Label>
            <Input
              id="sso-client-secret"
              type="password"
              value={draft.clientSecret}
              onChange={(e) => update({ clientSecret: e.target.value })}
              autoComplete="new-password"
              disabled={loading || !draft.enabled}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="sso-redirect-uri">{t('settings.sso.redirectUri')}</Label>
          <p className="text-xs text-muted-foreground">{t('settings.sso.redirectUriHint')}</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="sso-redirect-uri"
              readOnly
              value={redirectUri}
              className="font-mono text-xs sm:text-sm"
            />
            <Button
              type="button"
              variant="outline"
              className="shrink-0"
              onClick={() => void handleCopyRedirectUri()}
            >
              <Copy className="mr-1 size-4" />
              {t('settings.sso.copyRedirectUri')}
            </Button>
          </div>
        </div>

        <Button type="button" onClick={() => void handleSave()} disabled={loading || saving}>
          {t('settings.sso.saveConfiguration')}
        </Button>
      </CardContent>
    </Card>
  )
}
