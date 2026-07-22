import { ExternalLink } from 'lucide-react'
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
import { BoolField } from '@/shared/components/BoolField'
import { FormSelect } from '@/shared/components/FormSelect'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

const ANDROID_USER_MANAGER_DOCS_URL =
  'https://developer.android.com/reference/android/os/UserManager'

interface ConfigurationMdmTabProps {
  draft: Configuration
  applications: ConfigurationApplication[]
  onChange: (patch: Partial<Configuration>) => void
  onApplicationsChange: (applications: ConfigurationApplication[]) => void
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

  const mainApp = findConfigAppByUsedVersionId(applications, draft.mainAppId ?? undefined)
  const contentApp = findConfigAppByUsedVersionId(applications, draft.contentAppId ?? undefined)
  const qrUrl = buildConfigurationQrUrl(draft)
  const kioskMode = bool('kioskMode')
  const permissive = bool('permissive')

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

  const handleKioskModeChange = (checked: boolean) => {
    onChange({
      kioskMode: checked,
      permissive: checked ? false : draft.permissive,
    })
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{t('configurations.editor.enrollmentTitle')}</CardTitle>
          <CardDescription>{t('configurations.editor.enrollmentDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <BoolField
            id="kiosk-mode-enrollment"
            label={t('configurations.editor.fields.kioskMode')}
            checked={kioskMode}
            onCheckedChange={handleKioskModeChange}
          />

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
              disabled={!kioskMode}
              onSelect={handleContentAppSelect}
              placeholder={t('configurations.editor.searchApplication')}
            />
          </div>

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

      {kioskMode && (
        <Card>
          <CardHeader>
            <CardTitle>{t('configurations.editor.kioskOptionsTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <BoolField
              id="kiosk-home"
              label={t('configurations.editor.fields.kioskHome')}
              checked={bool('kioskHome')}
              onCheckedChange={(v) => onChange({ kioskHome: v })}
            />
            <BoolField
              id="kiosk-recents"
              label={t('configurations.editor.fields.kioskRecents')}
              checked={bool('kioskRecents')}
              onCheckedChange={(v) => onChange({ kioskRecents: v })}
            />
            <BoolField
              id="kiosk-notifications"
              label={t('configurations.editor.fields.kioskNotifications')}
              checked={bool('kioskNotifications')}
              onCheckedChange={(v) => onChange({ kioskNotifications: v })}
            />
            <BoolField
              id="kiosk-system-info"
              label={t('configurations.editor.fields.kioskSystemInfo')}
              checked={bool('kioskSystemInfo')}
              onCheckedChange={(v) => onChange({ kioskSystemInfo: v })}
            />
            <BoolField
              id="kiosk-keyguard"
              label={t('configurations.editor.fields.kioskKeyguard')}
              checked={bool('kioskKeyguard')}
              onCheckedChange={(v) => onChange({ kioskKeyguard: v })}
            />
            <BoolField
              id="kiosk-lock-buttons"
              label={t('configurations.editor.fields.kioskLockButtons')}
              checked={bool('kioskLockButtons')}
              onCheckedChange={(v) => onChange({ kioskLockButtons: v })}
            />
            <BoolField
              id="kiosk-exit"
              label={t('configurations.editor.fields.kioskExit')}
              checked={bool('kioskExit')}
              onCheckedChange={(v) => onChange({ kioskExit: v })}
            />
            <BoolField
              id="kiosk-screen-on"
              label={t('configurations.editor.fields.kioskScreenOn')}
              checked={bool('kioskScreenOn')}
              onCheckedChange={(v) => onChange({ kioskScreenOn: v })}
            />
          </CardContent>
        </Card>
      )}

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
          <FormSelect
            id="wifi-security"
            label={t('configurations.editor.fields.wifiSecurityType')}
            value={draft.wifiSecurityType ?? 'WPA'}
            onChange={(value) => onChange({ wifiSecurityType: value })}
            options={[
              { value: 'WPA', label: 'WPA' },
              { value: 'WEP', label: 'WEP' },
              { value: 'EAP', label: 'EAP' },
              { value: 'NONE', label: 'NONE' },
            ]}
            hint={t('configurations.editor.fields.wifiSecurityHint')}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('configurations.editor.mdmAdvancedTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="launcher-url">{t('configurations.editor.fields.launcherUrl')}</Label>
            <Input
              id="launcher-url"
              value={typeof draft.launcherUrl === 'string' ? draft.launcherUrl : ''}
              onChange={(e) => onChange({ launcherUrl: e.target.value || undefined })}
              autoComplete="off"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="qr-parameters">{t('configurations.editor.fields.qrParameters')}</Label>
            <Textarea
              id="qr-parameters"
              value={draft.qrParameters ?? ''}
              onChange={(e) => onChange({ qrParameters: e.target.value || undefined })}
              rows={3}
              className="resize-none font-mono text-xs"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="admin-extras">{t('configurations.editor.fields.adminExtras')}</Label>
            <Textarea
              id="admin-extras"
              value={draft.adminExtras ?? ''}
              onChange={(e) => onChange({ adminExtras: e.target.value || undefined })}
              rows={3}
              className="resize-none font-mono text-xs"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <BoolField
              id="mobile-enrollment"
              label={t('configurations.editor.fields.mobileEnrollment')}
              checked={bool('mobileEnrollment')}
              onCheckedChange={(v) => onChange({ mobileEnrollment: v })}
            />
            <BoolField
              id="encrypt-device"
              label={t('configurations.editor.fields.encryptDevice')}
              checked={bool('encryptDevice', true)}
              onCheckedChange={(v) => onChange({ encryptDevice: v })}
            />
            <BoolField
              id="permissive"
              label={t('configurations.editor.fields.permissive')}
              checked={permissive}
              disabled={kioskMode}
              onCheckedChange={(v) => onChange({ permissive: v })}
            />
            <BoolField
              id="lock-safe-settings"
              label={t('configurations.editor.fields.lockSafeSettings')}
              checked={bool('lockSafeSettings')}
              disabled={permissive}
              onCheckedChange={(v) => onChange({ lockSafeSettings: v })}
            />
            <BoolField
              id="block-status-bar"
              label={t('configurations.editor.fields.blockStatusBar')}
              checked={bool('blockStatusBar')}
              onCheckedChange={(v) => onChange({ blockStatusBar: v })}
            />
            <BoolField
              id="disable-screenshots-mdm"
              label={t('configurations.editor.fields.disableScreenshots')}
              checked={bool('disableScreenshots')}
              onCheckedChange={(v) => onChange({ disableScreenshots: v })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="allowed-classes">{t('configurations.editor.fields.allowedClasses')}</Label>
            <Textarea
              id="allowed-classes"
              value={draft.allowedClasses ?? ''}
              disabled={permissive}
              onChange={(e) => onChange({ allowedClasses: e.target.value })}
              rows={3}
              className="resize-none font-mono text-xs"
            />
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label htmlFor="restrictions">{t('configurations.editor.fields.restrictions')}</Label>
              <a
                href={ANDROID_USER_MANAGER_DOCS_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary underline-offset-4 hover:underline"
              >
                {t('configurations.editor.fields.restrictionsDocs')}
                <ExternalLink className="size-3 shrink-0" />
              </a>
            </div>
            <Textarea
              id="restrictions"
              value={draft.restrictions ?? ''}
              disabled={permissive}
              placeholder={t('configurations.editor.fields.restrictionsPlaceholder')}
              onChange={(e) => onChange({ restrictions: e.target.value || undefined })}
              rows={3}
              className="resize-none font-mono text-xs"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-server-url">{t('configurations.editor.fields.newServerUrl')}</Label>
            <Input
              id="new-server-url"
              value={draft.newServerUrl ?? ''}
              onChange={(e) => onChange({ newServerUrl: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
