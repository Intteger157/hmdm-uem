import { useTranslation } from 'react-i18next'
import type { Configuration } from '@/features/configurations/types/configuration'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface ConfigurationDesignTabProps {
  draft: Configuration
  onChange: (patch: Partial<Configuration>) => void
}

function BoolField({
  id,
  label,
  checked,
  onCheckedChange,
}: {
  id: string
  label: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center gap-2 text-sm">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onCheckedChange(e.target.checked)}
      />
      {label}
    </label>
  )
}

export function ConfigurationDesignTab({ draft, onChange }: ConfigurationDesignTabProps) {
  const { t } = useTranslation()

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
              onChange={(e) => onChange({ backgroundColor: e.target.value })}
              placeholder="#FFFFFF"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="text-color">{t('configurations.editor.fields.textColor')}</Label>
            <Input
              id="text-color"
              value={draft.textColor ?? ''}
              onChange={(e) => onChange({ textColor: e.target.value })}
              placeholder="#000000"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="bg-image">{t('configurations.editor.fields.backgroundImageUrl')}</Label>
          <Input
            id="bg-image"
            value={draft.backgroundImageUrl ?? ''}
            onChange={(e) => onChange({ backgroundImageUrl: e.target.value || undefined })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="header-template">{t('configurations.editor.fields.desktopHeader')}</Label>
          <Input
            id="header-template"
            value={draft.desktopHeaderTemplate ?? ''}
            onChange={(e) => onChange({ desktopHeaderTemplate: e.target.value || undefined })}
          />
        </div>

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
