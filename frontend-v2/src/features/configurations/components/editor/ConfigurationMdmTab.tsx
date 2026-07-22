import { useTranslation } from 'react-i18next'
import type { Configuration } from '@/features/configurations/types/configuration'
import type { ConfigurationApplication } from '@/features/configurations/types/configuration'
import { ConfigurationAppSearchInput } from '@/features/configurations/components/editor/ConfigurationAppSearchInput'
import {
  applyContentAppSelection,
  applyMainAppSelection,
  buildConfigurationQrUrl,
  findConfigAppByUsedVersionId,
  isQrEnrollmentReady,
} from '@/features/configurations/utils/configuration-app-utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface ConfigurationMdmTabProps {
  draft: Configuration
  applications: ConfigurationApplication[]
  onChange: (patch: Partial<Configuration>) => void
  onApplicationsChange: (applications: ConfigurationApplication[]) => void
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

export function ConfigurationMdmTab({
  draft,
  applications,
  onChange,
  onApplicationsChange,
}: ConfigurationMdmTabProps) {
  const { t } = useTranslation()

  const bool = (key: keyof Configuration, fallback = false) =>
    typeof draft[key] === 'boolean' ? (draft[key] as boolean) : fallback

  const mainApp = findConfigAppByUsedVersionId(applications, draft.mainAppId)
  const contentApp = findConfigAppByUsedVersionId(applications, draft.contentAppId)
  const qrUrl = buildConfigurationQrUrl(draft)

  const handleMainAppSelect = (app: ConfigurationApplication) => {
    onApplicationsChange(applyMainAppSelection(applications, app))
    onChange({
      mainAppId: app.usedVersionId,
      eventReceivingComponent:
        draft.eventReceivingComponent?.trim() ||
        (app.pkg === 'com.hmdm.launcher' ? 'com.hmdm.launcher.AdminReceiver' : draft.eventReceivingComponent),
    })
  }

  const handleContentAppSelect = (app: ConfigurationApplication) => {
    onApplicationsChange(applyContentAppSelection(applications, app))
    onChange({ contentAppId: app.usedVersionId })
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{t('configurations.editor.enrollmentTitle')}</CardTitle>
          <CardDescription>{t('configurations.editor.enrollmentDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mdm-application">{t('configurations.editor.fields.mdmApplication')}</Label>
            <ConfigurationAppSearchInput
              id="mdm-application"
              apps={applications}
              selected={mainApp}
              onSelect={handleMainAppSelect}
              placeholder={t('configurations.editor.searchApplication')}
            />
            <p className="text-xs text-muted-foreground">
              {t('configurations.editor.mdmApplicationHint')}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="admin-receiver">{t('configurations.editor.fields.adminReceiver')}</Label>
            <Input
              id="admin-receiver"
              value={draft.eventReceivingComponent ?? ''}
              placeholder="com.hmdm.launcher.AdminReceiver"
              onChange={(e) => onChange({ eventReceivingComponent: e.target.value || undefined })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="content-application">{t('configurations.editor.fields.contentApplication')}</Label>
            <ConfigurationAppSearchInput
              id="content-application"
              apps={applications}
              selected={contentApp}
              disabled={!bool('kioskMode')}
              onSelect={handleContentAppSelect}
              placeholder={t('configurations.editor.searchApplication')}
            />
          </div>

          <BoolField
            id="kiosk-mode-enrollment"
            label={t('configurations.editor.fields.kioskMode')}
            checked={bool('kioskMode')}
            onCheckedChange={(v) => onChange({ kioskMode: v })}
          />

          <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
            <Label>{t('configurations.editor.fields.qrCodeUrl')}</Label>
            {isQrEnrollmentReady(draft) && qrUrl ? (
              <a
                href={qrUrl}
                target="_blank"
                rel="noreferrer"
                className="break-all text-sm text-primary underline-offset-4 hover:underline"
              >
                {qrUrl}
              </a>
            ) : (
              <p className="text-sm text-amber-700 dark:text-amber-300">
                {t('configurations.editor.qrNotReadyHint')}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('configurations.editor.mdmConnectivityTitle')}</CardTitle>
          <CardDescription>{t('configurations.editor.mdmConnectivityDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <BoolField
            id="gps"
            label={t('configurations.editor.fields.gps')}
            checked={bool('gps')}
            onCheckedChange={(v) => onChange({ gps: v })}
          />
          <BoolField
            id="bluetooth"
            label={t('configurations.editor.fields.bluetooth')}
            checked={bool('bluetooth')}
            onCheckedChange={(v) => onChange({ bluetooth: v })}
          />
          <BoolField
            id="wifi"
            label={t('configurations.editor.fields.wifi')}
            checked={bool('wifi')}
            onCheckedChange={(v) => onChange({ wifi: v })}
          />
          <BoolField
            id="mobile-data"
            label={t('configurations.editor.fields.mobileData')}
            checked={bool('mobileData')}
            onCheckedChange={(v) => onChange({ mobileData: v })}
          />
          <BoolField
            id="usb-storage"
            label={t('configurations.editor.fields.usbStorage')}
            checked={bool('usbStorage')}
            onCheckedChange={(v) => onChange({ usbStorage: v })}
          />
          <BoolField
            id="mobile-enrollment"
            label={t('configurations.editor.fields.mobileEnrollment')}
            checked={bool('mobileEnrollment')}
            onCheckedChange={(v) => onChange({ mobileEnrollment: v })}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('configurations.editor.mdmModeTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <BoolField
            id="permissive"
            label={t('configurations.editor.fields.permissive')}
            checked={bool('permissive')}
            onCheckedChange={(v) => onChange({ permissive: v })}
          />
          <BoolField
            id="block-status-bar"
            label={t('configurations.editor.fields.blockStatusBar')}
            checked={bool('blockStatusBar')}
            onCheckedChange={(v) => onChange({ blockStatusBar: v })}
          />
          <BoolField
            id="encrypt-device"
            label={t('configurations.editor.fields.encryptDevice')}
            checked={bool('encryptDevice', true)}
            onCheckedChange={(v) => onChange({ encryptDevice: v })}
          />
          <BoolField
            id="disable-screenshots"
            label={t('configurations.editor.fields.disableScreenshots')}
            checked={bool('disableScreenshots')}
            onCheckedChange={(v) => onChange({ disableScreenshots: v })}
          />
          <BoolField
            id="kiosk-exit"
            label={t('configurations.editor.fields.kioskExit')}
            checked={bool('kioskExit')}
            onCheckedChange={(v) => onChange({ kioskExit: v })}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('configurations.editor.wifiProvisioningTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="wifi-ssid">{t('configurations.editor.fields.wifiSSID')}</Label>
            <Input
              id="wifi-ssid"
              value={draft.wifiSSID ?? ''}
              onChange={(e) => onChange({ wifiSSID: e.target.value || undefined })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wifi-password">{t('configurations.editor.fields.wifiPassword')}</Label>
            <Input
              id="wifi-password"
              value={draft.wifiPassword ?? ''}
              onChange={(e) => onChange({ wifiPassword: e.target.value || undefined })}
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="keepalive">{t('configurations.editor.fields.keepaliveTime')}</Label>
            <Input
              id="keepalive"
              type="number"
              min={0}
              value={draft.keepaliveTime ?? ''}
              onChange={(e) =>
                onChange({
                  keepaliveTime: e.target.value ? Number(e.target.value) : undefined,
                })
              }
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
