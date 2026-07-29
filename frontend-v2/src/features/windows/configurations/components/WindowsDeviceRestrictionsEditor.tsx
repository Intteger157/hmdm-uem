import { useTranslation } from 'react-i18next'
import { useWatch, useFormContext, type Control } from 'react-hook-form'
import {
  DEVICE_RESTRICTIONS_GROUPS,
  getPresetById,
  payloadFromUsbMode,
  usbModeFromPayload,
} from '@/features/windows/configurations/constants/device-restrictions-groups'
import type { ConfigProfileFormValues } from '@/features/windows/configurations/utils/windows-config-form'
import { BoolField } from '@/shared/components/BoolField'
import { FlatSelect } from '@/components/ui/flat-select'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'

interface WindowsDeviceRestrictionsEditorProps {
  control: Control<ConfigProfileFormValues>
  enabledPresetIds: string[]
  onPresetsChange: (enabledPresetIds: string[]) => void
  disabled?: boolean
}

export function WindowsDeviceRestrictionsEditor({
  control,
  enabledPresetIds,
  onPresetsChange,
  disabled = false,
}: WindowsDeviceRestrictionsEditorProps) {
  const { t } = useTranslation()
  const { setValue } = useFormContext<ConfigProfileFormValues>()
  const blockUsbStorage = useWatch({ control, name: 'payload.blockUsbStorage' })
  const usbReadOnly = useWatch({ control, name: 'payload.usbReadOnly' })
  const usbMode = usbModeFromPayload(Boolean(blockUsbStorage), Boolean(usbReadOnly))

  const togglePreset = (presetId: string, enabled: boolean) => {
    if (enabled) {
      onPresetsChange([...enabledPresetIds, presetId])
      return
    }
    onPresetsChange(enabledPresetIds.filter((id) => id !== presetId))
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        {t('windowsConfigurations.deviceRestrictions.description')}
      </p>

      {DEVICE_RESTRICTIONS_GROUPS.map((group) => (
        <section key={group.id} className="border border-zinc-700/80">
          <div className="border-b border-zinc-700/80 bg-zinc-800/40 px-4 py-2.5">
            <h3 className="text-sm font-medium text-zinc-100">{t(group.titleKey)}</h3>
          </div>
          <div className="space-y-0 divide-y divide-zinc-700/60">
            {group.id === 'securityDefender' ? (
              <>
                <FormField
                  control={control}
                  name="payload.defenderEnabled"
                  render={({ field }) => (
                    <FormItem className="px-4 py-3">
                      <FormControl>
                        <BoolField
                          id="windows-config-defender"
                          label={t('windowsConfigurations.form.defenderEnabled')}
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={control}
                  name="payload.requireBitLocker"
                  render={({ field }) => (
                    <FormItem className="px-4 py-3">
                      <FormControl>
                        <BoolField
                          id="windows-config-require-bitlocker"
                          label={t('windowsConfigurations.form.requireBitLocker')}
                          hint={t('windowsConfigurations.form.requireBitLockerHint')}
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </>
            ) : null}

            {group.id === 'hardwareUsb' ? (
              <div className="space-y-2 px-4 py-3">
                <FormLabel>{t('windowsConfigurations.deviceRestrictions.usbMode')}</FormLabel>
                <FlatSelect
                  className="max-w-md"
                  value={usbMode}
                  disabled={disabled}
                  onChange={(nextMode) => {
                    const next = payloadFromUsbMode(nextMode as 'none' | 'readonly' | 'block')
                    setValue('payload.blockUsbStorage', next.blockUsbStorage, { shouldDirty: true })
                    setValue('payload.usbReadOnly', next.usbReadOnly, { shouldDirty: true })
                  }}
                  options={[
                    {
                      value: 'none',
                      label: t('windowsConfigurations.deviceRestrictions.usbModeNone'),
                    },
                    {
                      value: 'readonly',
                      label: t('windowsConfigurations.deviceRestrictions.usbModeReadOnly'),
                    },
                    {
                      value: 'block',
                      label: t('windowsConfigurations.deviceRestrictions.usbModeBlock'),
                    },
                  ]}
                />
                <p className="text-xs text-muted-foreground">
                  {t('windowsConfigurations.deviceRestrictions.usbModeHint')}
                </p>
              </div>
            ) : null}

            {group.id === 'systemPrivacy' ? (
              <FormField
                control={control}
                name="payload.screenLockTimeout"
                render={({ field }) => (
                  <FormItem className="space-y-2 px-4 py-3">
                    <FormLabel>{t('windowsConfigurations.form.screenLockTimeout')}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        className="max-w-xs border-zinc-700 bg-zinc-800/80 focus-visible:border-zinc-500 focus-visible:ring-0"
                        value={field.value}
                        disabled={disabled}
                        onChange={(event) => {
                          const parsed = Number.parseInt(event.target.value, 10)
                          field.onChange(Number.isNaN(parsed) ? 0 : parsed)
                        }}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      {t('windowsConfigurations.form.screenLockTimeoutHint')}
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}

            {group.presetIds.map((presetId) => {
              const preset = getPresetById(presetId)
              if (!preset) {
                return null
              }

              const isEnabled = enabledPresetIds.includes(presetId)
              const switchId = `device-restriction-${presetId}`

              return (
                <div key={presetId} className="flex items-start justify-between gap-4 px-4 py-3">
                  <div className="min-w-0 space-y-1">
                    <label htmlFor={switchId} className="text-sm font-medium text-zinc-100">
                      {t(preset.labelKey)}
                    </label>
                    <p className="text-xs text-muted-foreground">{t(preset.descriptionKey)}</p>
                  </div>
                  <Switch
                    id={switchId}
                    checked={isEnabled}
                    disabled={disabled}
                    onCheckedChange={(checked) => togglePreset(presetId, checked)}
                    className="mt-0.5"
                  />
                </div>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
