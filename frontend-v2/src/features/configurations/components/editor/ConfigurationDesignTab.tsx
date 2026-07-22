import { useTranslation } from 'react-i18next'
import type { Configuration } from '@/features/configurations/types/configuration'
import { BackgroundImageUrlField } from '@/shared/components/BackgroundImageUrlField'
import { BoolField } from '@/shared/components/BoolField'
import { FormSelect } from '@/shared/components/FormSelect'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface ConfigurationDesignTabProps {
  draft: Configuration
  onChange: (patch: Partial<Configuration>) => void
}

export function ConfigurationDesignTab({ draft, onChange }: ConfigurationDesignTabProps) {
  const { t } = useTranslation()
  const disabled = draft.useDefaultDesignSettings === true

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('configurations.editor.designTitle')}</CardTitle>
        <CardDescription>{t('configurations.editor.designDescription')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <BoolField
          id="use-default-design"
          label={t('configurations.editor.fields.useDefaultDesign')}
          checked={draft.useDefaultDesignSettings === true}
          onCheckedChange={(checked) => onChange({ useDefaultDesignSettings: checked })}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="bg-color">{t('configurations.editor.fields.backgroundColor')}</Label>
            <Input
              id="bg-color"
              value={draft.backgroundColor ?? ''}
              disabled={disabled}
              onChange={(e) => onChange({ backgroundColor: e.target.value })}
              placeholder="#FFFFFF"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="text-color">{t('configurations.editor.fields.textColor')}</Label>
            <Input
              id="text-color"
              value={draft.textColor ?? ''}
              disabled={disabled}
              onChange={(e) => onChange({ textColor: e.target.value })}
              placeholder="#000000"
            />
          </div>
        </div>

        <BackgroundImageUrlField
          label={t('configurations.editor.fields.backgroundImageUrl')}
          value={draft.backgroundImageUrl ?? ''}
          disabled={disabled}
          onChange={(url) => onChange({ backgroundImageUrl: url })}
        />

        <FormSelect
          id="icon-size"
          label={t('configurations.editor.fields.iconSize')}
          value={draft.iconSize ?? 'MEDIUM'}
          disabled={disabled}
          onChange={(value) => onChange({ iconSize: value })}
          options={[
            { value: 'SMALL', label: t('configurations.editor.iconSize.small') },
            { value: 'MEDIUM', label: t('configurations.editor.iconSize.medium') },
            { value: 'LARGE', label: t('configurations.editor.iconSize.large') },
          ]}
        />

        <FormSelect
          id="desktop-header"
          label={t('configurations.editor.fields.desktopHeaderType')}
          value={draft.desktopHeader ?? 'NO_HEADER'}
          disabled={disabled}
          onChange={(value) => onChange({ desktopHeader: value })}
          options={[
            { value: 'NO_HEADER', label: t('configurations.editor.desktopHeader.no') },
            { value: 'DEVICE_ID', label: t('configurations.editor.desktopHeader.deviceId') },
            { value: 'DESCRIPTION', label: t('configurations.editor.desktopHeader.description') },
            { value: 'TEMPLATE', label: t('configurations.editor.desktopHeader.custom') },
          ]}
        />

        {draft.desktopHeader === 'TEMPLATE' && (
          <div className="space-y-2">
            <Label htmlFor="header-template">{t('configurations.editor.fields.desktopHeader')}</Label>
            <Input
              id="header-template"
              value={draft.desktopHeaderTemplate ?? ''}
              disabled={disabled}
              onChange={(e) => onChange({ desktopHeaderTemplate: e.target.value || undefined })}
            />
          </div>
        )}

        <FormSelect
          id="orientation"
          label={t('configurations.editor.fields.orientation')}
          value={draft.orientation ?? 0}
          onChange={(value) => onChange({ orientation: Number(value) })}
          options={[
            { value: 0, label: t('configurations.editor.orientation.none') },
            { value: 1, label: t('configurations.editor.orientation.portrait') },
            { value: 2, label: t('configurations.editor.orientation.landscape') },
          ]}
        />

        <BoolField
          id="display-status"
          label={t('configurations.editor.fields.displayStatus')}
          checked={draft.displayStatus === true}
          onCheckedChange={(checked) => onChange({ displayStatus: checked })}
        />
      </CardContent>
    </Card>
  )
}
