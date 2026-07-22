import { useTranslation } from 'react-i18next'
import type { Configuration } from '@/features/configurations/types/configuration'
import { BoolField } from '@/shared/components/BoolField'
import { FormSelect } from '@/shared/components/FormSelect'
import { TimeInput } from '@/shared/components/TimeInput'
import { TriStateRadio } from '@/shared/components/TriStateRadio'
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

  const triStateLabels = {
    any: t('configurations.editor.triState.any'),
    disabled: t('configurations.editor.triState.disabled'),
    enabled: t('configurations.editor.triState.enabled'),
  }

  const handleRequestUpdatesChange = (value: string) => {
    const patch: Partial<Configuration> = { requestUpdates: value }
    if (value === 'WIFI') {
      patch.wifi = true
    } else if (value === 'GPS') {
      patch.gps = true
    }
    onChange(patch)
  }

  const pushHint =
    draft.pushOptions === 'mqttAlarm'
      ? t('configurations.editor.fields.pushOptionsMqttHint')
      : draft.pushOptions === 'polling'
        ? t('configurations.editor.fields.pushOptionsPollingHint')
        : ''

  return (
    <div className="space-y-4">
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('configurations.editor.commonPolicyTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormSelect
            id="request-updates"
            label={t('configurations.editor.fields.requestUpdates')}
            value={draft.requestUpdates ?? 'DONOTTRACK'}
            onChange={handleRequestUpdatesChange}
            options={[
              { value: 'DONOTTRACK', label: t('configurations.editor.requestUpdates.donottrack') },
              { value: 'GPS', label: t('configurations.editor.requestUpdates.gps') },
              { value: 'WIFI', label: t('configurations.editor.requestUpdates.wifi') },
            ]}
          />

          <FormSelect
            id="app-permissions"
            label={t('configurations.editor.fields.appPermissions')}
            value={draft.appPermissions ?? 'GRANTALL'}
            onChange={(value) => onChange({ appPermissions: value })}
            options={[
              { value: 'GRANTALL', label: t('configurations.editor.appPermissions.grant') },
              { value: 'ASKLOCATION', label: t('configurations.editor.appPermissions.askLocation') },
              { value: 'DENYLOCATION', label: t('configurations.editor.appPermissions.denyLocation') },
              { value: 'ASKALL', label: t('configurations.editor.appPermissions.askAll') },
            ]}
          />

          <FormSelect
            id="push-options"
            label={t('configurations.editor.fields.pushOptions')}
            value={draft.pushOptions ?? 'mqttAlarm'}
            onChange={(value) =>
              onChange({
                pushOptions: value,
                keepaliveTime: value === 'mqttAlarm' ? (draft.keepaliveTime ?? 300) : draft.keepaliveTime,
              })
            }
            options={[
              { value: 'mqttAlarm', label: t('configurations.editor.pushOptions.mqttAlarm') },
              { value: 'polling', label: t('configurations.editor.pushOptions.polling') },
            ]}
            hint={pushHint || undefined}
          />

          {draft.pushOptions === 'mqttAlarm' && (
            <FormSelect
              id="keepalive-time"
              label={t('configurations.editor.fields.keepaliveInterval')}
              value={draft.keepaliveTime ?? 300}
              onChange={(value) => onChange({ keepaliveTime: Number(value) })}
              options={[
                { value: 60, label: t('configurations.editor.keepalive.1min') },
                { value: 120, label: t('configurations.editor.keepalive.2min') },
                { value: 180, label: t('configurations.editor.keepalive.3min') },
                { value: 300, label: t('configurations.editor.keepalive.5min') },
                { value: 600, label: t('configurations.editor.keepalive.10min') },
                { value: 900, label: t('configurations.editor.keepalive.15min') },
              ]}
            />
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>{t('configurations.editor.fields.gps')}</Label>
              <TriStateRadio
                name="gps"
                value={draft.gps}
                labels={triStateLabels}
                onChange={(value) => onChange({ gps: value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('configurations.editor.fields.bluetooth')}</Label>
              <TriStateRadio
                name="bluetooth"
                value={draft.bluetooth}
                labels={triStateLabels}
                onChange={(value) => onChange({ bluetooth: value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('configurations.editor.fields.wifi')}</Label>
              <TriStateRadio
                name="wifi"
                value={draft.wifi}
                labels={triStateLabels}
                onChange={(value) => onChange({ wifi: value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('configurations.editor.fields.mobileData')}</Label>
              <TriStateRadio
                name="mobile-data"
                value={draft.mobileData}
                labels={triStateLabels}
                onChange={(value) => onChange({ mobileData: value })}
              />
            </div>
          </div>

          <BoolField
            id="usb-storage"
            label={t('configurations.editor.fields.usbStorage')}
            checked={draft.usbStorage === true}
            onCheckedChange={(checked) => onChange({ usbStorage: checked })}
          />

          <div className="space-y-2">
            <Label>{t('configurations.editor.fields.brightness')}</Label>
            <TriStateRadio
              name="auto-brightness"
              value={draft.autoBrightness}
              labels={{
                any: t('configurations.editor.brightness.none'),
                disabled: t('configurations.editor.brightness.manual'),
                enabled: t('configurations.editor.brightness.auto'),
              }}
              onChange={(value) => onChange({ autoBrightness: value })}
            />
          </div>

          {draft.autoBrightness === false && (
            <div className="space-y-2">
              <Label htmlFor="brightness">{t('configurations.editor.fields.brightnessValue')}</Label>
              <div className="flex items-center gap-3">
                <input
                  id="brightness"
                  type="range"
                  min={0}
                  max={255}
                  step={1}
                  value={draft.brightness ?? 128}
                  onChange={(e) => onChange({ brightness: Number(e.target.value) })}
                  className="flex-1"
                />
                <span className="w-10 text-sm tabular-nums">{draft.brightness ?? 128}</span>
              </div>
            </div>
          )}

          <BoolField
            id="manage-timeout"
            label={t('configurations.editor.fields.manageTimeout')}
            checked={draft.manageTimeout === true}
            onCheckedChange={(checked) => onChange({ manageTimeout: checked })}
          />

          {draft.manageTimeout && (
            <div className="space-y-2">
              <Label htmlFor="timeout">{t('configurations.editor.fields.timeout')}</Label>
              <Input
                id="timeout"
                type="number"
                min={0}
                value={draft.timeout ?? ''}
                onChange={(e) =>
                  onChange({ timeout: e.target.value ? Number(e.target.value) : undefined })
                }
              />
            </div>
          )}

          <BoolField
            id="lock-volume"
            label={t('configurations.editor.fields.lockVolume')}
            checked={draft.lockVolume === true}
            onCheckedChange={(checked) => onChange({ lockVolume: checked })}
          />

          <BoolField
            id="manage-volume"
            label={t('configurations.editor.fields.manageVolume')}
            checked={draft.manageVolume === true}
            onCheckedChange={(checked) => onChange({ manageVolume: checked })}
          />

          {draft.manageVolume && (
            <div className="space-y-2">
              <Label htmlFor="volume">{t('configurations.editor.fields.volume')}</Label>
              <div className="flex items-center gap-3">
                <input
                  id="volume"
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={draft.volume ?? 50}
                  onChange={(e) => onChange({ volume: Number(e.target.value) })}
                  className="flex-1"
                />
                <span className="w-10 text-sm tabular-nums">{draft.volume ?? 50}</span>
              </div>
            </div>
          )}

          <FormSelect
            id="timezone-mode"
            label={t('configurations.editor.fields.timeZoneMode')}
            value={draft.timeZoneMode ?? 'default'}
            onChange={(value) =>
              onChange({ timeZoneMode: value as Configuration['timeZoneMode'] })
            }
            options={[
              { value: 'default', label: t('configurations.editor.timeZone.default') },
              { value: 'auto', label: t('configurations.editor.timeZone.auto') },
              { value: 'manual', label: t('configurations.editor.timeZone.manual') },
            ]}
          />

          {draft.timeZoneMode === 'manual' && (
            <div className="space-y-2">
              <Label htmlFor="timezone">{t('configurations.editor.fields.timeZone')}</Label>
              <Input
                id="timezone"
                value={draft.timeZone ?? ''}
                onChange={(e) => onChange({ timeZone: e.target.value })}
                placeholder="Europe/Moscow"
              />
            </div>
          )}

          <FormSelect
            id="system-update-type"
            label={t('configurations.editor.fields.systemUpdate')}
            value={draft.systemUpdateType ?? 0}
            onChange={(value) => onChange({ systemUpdateType: Number(value) })}
            options={[
              { value: 0, label: t('configurations.editor.systemUpdate.default') },
              { value: 1, label: t('configurations.editor.systemUpdate.immediate') },
              { value: 2, label: t('configurations.editor.systemUpdate.scheduled') },
              { value: 3, label: t('configurations.editor.systemUpdate.postponed') },
            ]}
          />

          {draft.systemUpdateType === 2 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <TimeInput
                id="system-update-from"
                label={t('configurations.editor.fields.systemUpdateFrom')}
                value={draft.systemUpdateFrom ?? '01:00'}
                onChange={(value) => onChange({ systemUpdateFrom: value })}
              />
              <TimeInput
                id="system-update-to"
                label={t('configurations.editor.fields.systemUpdateTo')}
                value={draft.systemUpdateTo ?? '05:59'}
                onChange={(value) => onChange({ systemUpdateTo: value })}
              />
            </div>
          )}

          <BoolField
            id="schedule-app-update"
            label={t('configurations.editor.fields.scheduleAppUpdate')}
            checked={draft.scheduleAppUpdate === true}
            onCheckedChange={(checked) => onChange({ scheduleAppUpdate: checked })}
          />

          {draft.scheduleAppUpdate && (
            <div className="grid gap-4 sm:grid-cols-2">
              <TimeInput
                id="app-update-from"
                label={t('configurations.editor.fields.appUpdateFrom')}
                value={draft.appUpdateFrom ?? '01:00'}
                onChange={(value) => onChange({ appUpdateFrom: value })}
              />
              <TimeInput
                id="app-update-to"
                label={t('configurations.editor.fields.appUpdateTo')}
                value={draft.appUpdateTo ?? '05:59'}
                onChange={(value) => onChange({ appUpdateTo: value })}
              />
            </div>
          )}

          <FormSelect
            id="download-updates"
            label={t('configurations.editor.fields.downloadUpdates')}
            value={draft.downloadUpdates ?? 'UNLIMITED'}
            onChange={(value) => onChange({ downloadUpdates: value })}
            options={[
              { value: 'UNLIMITED', label: t('configurations.editor.downloadUpdates.unlimited') },
              { value: 'LIMITED', label: t('configurations.editor.downloadUpdates.limited') },
              { value: 'WIFI', label: t('configurations.editor.downloadUpdates.wifi') },
            ]}
          />

          <FormSelect
            id="password-mode"
            label={t('configurations.editor.fields.passwordMode')}
            value={draft.passwordMode ?? 'any'}
            onChange={(value) => onChange({ passwordMode: value })}
            options={[
              { value: 'any', label: t('configurations.editor.passwordMode.any') },
              { value: 'present', label: t('configurations.editor.passwordMode.present') },
              { value: 'easy', label: t('configurations.editor.passwordMode.easy') },
              { value: 'moderate', label: t('configurations.editor.passwordMode.moderate') },
              { value: 'strong', label: t('configurations.editor.passwordMode.strong') },
            ]}
          />

          <BoolField
            id="show-wifi"
            label={t('configurations.editor.fields.showWifi')}
            checked={draft.showWifi === true}
            onCheckedChange={(checked) => onChange({ showWifi: checked })}
          />

          <BoolField
            id="run-default-launcher"
            label={t('configurations.editor.fields.runDefaultLauncher')}
            hint={t('configurations.editor.fields.runDefaultLauncherHint')}
            checked={draft.runDefaultLauncher === true}
            onCheckedChange={(checked) => onChange({ runDefaultLauncher: checked })}
          />

          <BoolField
            id="disable-screenshots-common"
            label={t('configurations.editor.fields.disableScreenshots')}
            checked={draft.disableScreenshots === true}
            onCheckedChange={(checked) => onChange({ disableScreenshots: checked })}
          />

          <BoolField
            id="autostart-foreground"
            label={t('configurations.editor.fields.autostartForeground')}
            checked={draft.autostartForeground === true}
            onCheckedChange={(checked) => onChange({ autostartForeground: checked })}
          />
        </CardContent>
      </Card>
    </div>
  )
}
