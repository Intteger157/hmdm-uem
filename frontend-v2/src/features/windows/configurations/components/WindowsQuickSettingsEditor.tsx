import { useTranslation } from 'react-i18next'
import { QUICK_POLICIES_PRESETS } from '@/features/windows/configurations/constants/quick-policies-presets'
import { Switch } from '@/components/ui/switch'

interface WindowsQuickSettingsEditorProps {
  enabledPresetIds: string[]
  onChange: (enabledPresetIds: string[]) => void
  disabled?: boolean
}

export function WindowsQuickSettingsEditor({
  enabledPresetIds,
  onChange,
  disabled = false,
}: WindowsQuickSettingsEditorProps) {
  const { t } = useTranslation()

  const togglePreset = (presetId: string, enabled: boolean) => {
    if (enabled) {
      onChange([...enabledPresetIds, presetId])
      return
    }

    onChange(enabledPresetIds.filter((id) => id !== presetId))
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t('windowsConfigurations.quickSettings.hint')}
      </p>

      <div className="space-y-3">
        {QUICK_POLICIES_PRESETS.map((preset) => {
          const isEnabled = enabledPresetIds.includes(preset.id)
          const switchId = `quick-policy-${preset.id}`

          return (
            <div
              key={preset.id}
              className="flex items-start justify-between gap-4 rounded-lg border p-4"
            >
              <div className="min-w-0 space-y-1">
                <label htmlFor={switchId} className="text-sm font-medium">
                  {t(preset.labelKey)}
                </label>
                <p className="text-xs text-muted-foreground">{t(preset.descriptionKey)}</p>
              </div>
              <Switch
                id={switchId}
                checked={isEnabled}
                onCheckedChange={(checked) => togglePreset(preset.id, checked)}
                disabled={disabled}
                className="mt-0.5"
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
