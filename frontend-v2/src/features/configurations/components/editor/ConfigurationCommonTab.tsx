import { useTranslation } from 'react-i18next'
import type { Configuration } from '@/features/configurations/types/configuration'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface ConfigurationCommonTabProps {
  draft: Configuration
  onChange: (patch: Partial<Configuration>) => void
}

export function ConfigurationCommonTab({ draft, onChange }: ConfigurationCommonTabProps) {
  const { t } = useTranslation()

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('configurations.editor.commonTitle')}</CardTitle>
        <CardDescription>{t('configurations.editor.commonDescription')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="config-name">{t('configurations.editor.fields.name')}</Label>
          <Input
            id="config-name"
            value={draft.name}
            onChange={(e) => onChange({ name: e.target.value })}
            autoComplete="off"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="config-description">{t('configurations.editor.fields.description')}</Label>
          <Textarea
            id="config-description"
            value={draft.description ?? ''}
            onChange={(e) => onChange({ description: e.target.value })}
            rows={3}
            className="resize-none"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="config-password">{t('configurations.editor.fields.password')}</Label>
          <Input
            id="config-password"
            value={typeof draft.password === 'string' ? draft.password : ''}
            onChange={(e) => onChange({ password: e.target.value })}
            autoComplete="off"
          />
        </div>
        <div className="space-y-2">
          <Label>{t('configurations.editor.fields.qrCodeKey')}</Label>
          <Input value={draft.qrCodeKey ?? '—'} readOnly disabled />
        </div>
        <div className="space-y-2">
          <Label htmlFor="config-launcher-url">{t('configurations.editor.fields.launcherUrl')}</Label>
          <Input
            id="config-launcher-url"
            value={typeof draft.launcherUrl === 'string' ? draft.launcherUrl : ''}
            onChange={(e) => onChange({ launcherUrl: e.target.value || undefined })}
            autoComplete="off"
          />
        </div>
      </CardContent>
    </Card>
  )
}
