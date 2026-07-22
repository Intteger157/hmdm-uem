import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { setAppLanguage } from '@/shared/lib/i18n'
import {
  DEVICE_COLUMN_FIELDS,
  type Settings,
  type UserRoleSettings,
} from '@/features/settings/api/settings-api'
import {
  useSettingsQuery,
  useUpdateDesignSettingsMutation,
  useUpdateMiscLanguageSettingsMutation,
  useUpdateUserRoleSettingsMutation,
  useUserRoleSettingsQuery,
} from '@/features/settings/hooks/use-settings'
import { useUserRolesQuery } from '@/features/users/hooks/use-users'
import { BoolField } from '@/shared/components/BoolField'
import { FormSelect } from '@/shared/components/FormSelect'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'

export function SettingsPage() {
  const { t, i18n } = useTranslation()
  const { data: settings, isLoading } = useSettingsQuery()
  const rolesQuery = useUserRolesQuery()
  const designMutation = useUpdateDesignSettingsMutation()
  const miscLangMutation = useUpdateMiscLanguageSettingsMutation()
  const columnsMutation = useUpdateUserRoleSettingsMutation()

  const [draft, setDraft] = useState<Settings>({})
  const [selectedRoleId, setSelectedRoleId] = useState<number>(0)
  const [roleSettingsCache, setRoleSettingsCache] = useState<Record<number, UserRoleSettings>>({})
  const [currentRoleSettings, setCurrentRoleSettings] = useState<UserRoleSettings>({})

  const roleSettingsQuery = useUserRoleSettingsQuery(selectedRoleId || undefined)

  useEffect(() => {
    if (settings) {
      setDraft(structuredClone(settings))
    }
  }, [settings])

  useEffect(() => {
    if (rolesQuery.data?.[0]?.id && !selectedRoleId) {
      setSelectedRoleId(rolesQuery.data[0].id)
    }
  }, [rolesQuery.data, selectedRoleId])

  useEffect(() => {
    if (roleSettingsQuery.data && selectedRoleId) {
      setRoleSettingsCache((prev) => ({ ...prev, [selectedRoleId]: roleSettingsQuery.data! }))
      setCurrentRoleSettings(roleSettingsQuery.data)
    }
  }, [roleSettingsQuery.data, selectedRoleId])

  const handleRoleChange = (roleId: number) => {
    setSelectedRoleId(roleId)
    if (roleSettingsCache[roleId]) {
      setCurrentRoleSettings(roleSettingsCache[roleId])
    }
  }

  const handleSaveDesign = async () => {
    try {
      await designMutation.mutateAsync(draft)
      toast.success(t('settings.design.saved'))
    } catch {
      toast.error(t('settings.saveError'))
    }
  }

  const handleSaveMiscLang = async () => {
    try {
      await miscLangMutation.mutateAsync(draft)
      toast.success(t('settings.misc.saved'))
    } catch {
      toast.error(t('settings.saveError'))
    }
  }

  const handleSaveColumns = async () => {
    const nextCache = { ...roleSettingsCache, [selectedRoleId]: currentRoleSettings }
    setRoleSettingsCache(nextCache)
    try {
      await columnsMutation.mutateAsync(Object.values(nextCache))
      toast.success(t('settings.columns.saved'))
    } catch {
      toast.error(t('settings.saveError'))
    }
  }

  if (isLoading || !settings) {
    return <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('settings.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('settings.subtitle')}</p>
      </div>

      <Tabs defaultValue="design">
        <TabsList className="flex-wrap">
          <TabsTrigger value="design">{t('settings.tabs.design')}</TabsTrigger>
          <TabsTrigger value="columns">{t('settings.tabs.columns')}</TabsTrigger>
          <TabsTrigger value="language">{t('settings.tabs.language')}</TabsTrigger>
          <TabsTrigger value="misc">{t('settings.tabs.misc')}</TabsTrigger>
          <TabsTrigger value="security">{t('settings.tabs.security')}</TabsTrigger>
        </TabsList>

        <TabsContent value="design">
          <Card>
            <CardHeader><CardTitle>{t('settings.tabs.design')}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t('settings.design.backgroundColor')}</Label>
                  <Input value={draft.backgroundColor ?? ''} onChange={(e) => setDraft({ ...draft, backgroundColor: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>{t('settings.design.textColor')}</Label>
                  <Input value={draft.textColor ?? ''} onChange={(e) => setDraft({ ...draft, textColor: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t('settings.design.backgroundImage')}</Label>
                <Input value={draft.backgroundImageUrl ?? ''} onChange={(e) => setDraft({ ...draft, backgroundImageUrl: e.target.value })} />
              </div>
              <FormSelect id="settings-icon-size" label={t('settings.design.iconSize')} value={draft.iconSize ?? 'MEDIUM'} onChange={(v) => setDraft({ ...draft, iconSize: v })} options={[
                { value: 'SMALL', label: t('configurations.editor.iconSize.small') },
                { value: 'MEDIUM', label: t('configurations.editor.iconSize.medium') },
                { value: 'LARGE', label: t('configurations.editor.iconSize.large') },
              ]} />
              <FormSelect id="settings-desktop-header" label={t('settings.design.desktopHeader')} value={draft.desktopHeader ?? 'NO_HEADER'} onChange={(v) => setDraft({ ...draft, desktopHeader: v })} options={[
                { value: 'NO_HEADER', label: t('configurations.editor.desktopHeader.no') },
                { value: 'DEVICE_ID', label: t('configurations.editor.desktopHeader.deviceId') },
                { value: 'DESCRIPTION', label: t('configurations.editor.desktopHeader.description') },
                { value: 'TEMPLATE', label: t('configurations.editor.desktopHeader.custom') },
              ]} />
              {draft.desktopHeader === 'TEMPLATE' && (
                <div className="space-y-2">
                  <Label>{t('settings.design.headerTemplate')}</Label>
                  <Input value={draft.desktopHeaderTemplate ?? ''} onChange={(e) => setDraft({ ...draft, desktopHeaderTemplate: e.target.value })} />
                </div>
              )}
              <Button type="button" onClick={() => void handleSaveDesign()} disabled={designMutation.isPending}>
                {t('common.save')}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="columns">
          <Card>
            <CardHeader><CardTitle>{t('settings.tabs.columns')}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <FormSelect id="settings-role" label={t('settings.columns.role')} value={selectedRoleId} onChange={(v) => handleRoleChange(Number(v))} options={(rolesQuery.data ?? []).map((role) => ({ value: role.id ?? 0, label: role.name }))} />
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {DEVICE_COLUMN_FIELDS.map((field) => (
                  <BoolField
                    key={field.key}
                    id={`col-${field.key}`}
                    label={t(field.labelKey)}
                    checked={currentRoleSettings[field.key] === true}
                    onCheckedChange={(checked) =>
                      setCurrentRoleSettings((prev) => ({ ...prev, [field.key]: checked }))
                    }
                  />
                ))}
              </div>
              <Button type="button" onClick={() => void handleSaveColumns()} disabled={columnsMutation.isPending}>
                {t('common.save')}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="language">
          <Card>
            <CardHeader><CardTitle>{t('settings.tabs.language')}</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="settings-console-language">{t('settings.language.consoleLabel')}</Label>
                <p className="text-xs text-muted-foreground">{t('settings.language.consoleHint')}</p>
                <NativeSelect
                  id="settings-console-language"
                  className="max-w-xs"
                  value={i18n.language.startsWith('ru') ? 'ru' : 'en'}
                  onChange={(e) => setAppLanguage(e.target.value as 'en' | 'ru')}
                >
                  <option value="en">{t('language.en')}</option>
                  <option value="ru">{t('language.ru')}</option>
                </NativeSelect>
              </div>

              <div className="space-y-4 border-t border-border pt-6">
                <div>
                  <p className="text-sm font-medium">{t('settings.language.deviceDefault')}</p>
                  <p className="text-xs text-muted-foreground">{t('settings.language.deviceDefaultHint')}</p>
                </div>
                <BoolField id="use-default-language" label={t('settings.language.useDefault')} checked={draft.useDefaultLanguage === true} onCheckedChange={(checked) => setDraft({ ...draft, useDefaultLanguage: checked })} />
                <FormSelect id="settings-language" label={t('settings.language.label')} value={draft.language ?? 'en_US'} disabled={draft.useDefaultLanguage === true} onChange={(v) => setDraft({ ...draft, language: v })} options={[
                  { value: 'en_US', label: 'English' },
                  { value: 'ru_RU', label: 'Русский' },
                ]} />
                <Button type="button" onClick={() => void handleSaveMiscLang()} disabled={miscLangMutation.isPending}>
                  {t('common.save')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="misc">
          <Card>
            <CardHeader><CardTitle>{t('settings.tabs.misc')}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{t('settings.misc.phoneFormat')}</Label>
                <Input value={draft.phoneNumberFormat ?? ''} onChange={(e) => setDraft({ ...draft, phoneNumberFormat: e.target.value })} />
              </div>
              {[1, 2, 3].map((n) => (
                <div key={n} className="space-y-2 rounded-lg border p-3">
                  <Label>{t('settings.misc.customProperty', { n })}</Label>
                  <Input
                    value={String(draft[`customPropertyName${n}` as keyof Settings] ?? '')}
                    onChange={(e) => setDraft({ ...draft, [`customPropertyName${n}`]: e.target.value })}
                  />
                  <BoolField
                    id={`custom-multiline-${n}`}
                    label={t('settings.misc.multiline')}
                    checked={draft[`customMultiline${n}` as keyof Settings] === true}
                    onCheckedChange={(checked) => setDraft({ ...draft, [`customMultiline${n}`]: checked })}
                  />
                </div>
              ))}
              <BoolField id="create-new-devices" label={t('settings.misc.createNewDevices')} checked={draft.createNewDevices === true} onCheckedChange={(checked) => setDraft({ ...draft, createNewDevices: checked })} />
              <Button type="button" onClick={() => void handleSaveMiscLang()} disabled={miscLangMutation.isPending}>
                {t('common.save')}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card>
            <CardHeader><CardTitle>{t('settings.tabs.security')}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{t('settings.security.passwordLength')}</Label>
                <Input type="number" min={0} value={draft.passwordLength ?? ''} onChange={(e) => setDraft({ ...draft, passwordLength: Number(e.target.value) })} />
              </div>
              <FormSelect id="password-strength" label={t('settings.security.passwordStrength')} value={draft.passwordStrength ?? 0} onChange={(v) => setDraft({ ...draft, passwordStrength: Number(v) })} options={[
                { value: 0, label: t('settings.security.strength.any') },
                { value: 1, label: t('settings.security.strength.letters') },
                { value: 2, label: t('settings.security.strength.strong') },
              ]} />
              <BoolField id="password-reset" label={t('settings.security.passwordReset')} checked={draft.passwordReset === true} onCheckedChange={(checked) => setDraft({ ...draft, passwordReset: checked })} />
              <FormSelect id="idle-logout" label={t('settings.security.idleLogout')} value={draft.idleLogout ?? 0} onChange={(v) => setDraft({ ...draft, idleLogout: Number(v) || null })} options={[
                { value: 0, label: t('settings.security.idle.never') },
                { value: 300, label: '5 min' },
                { value: 600, label: '10 min' },
                { value: 1800, label: '30 min' },
                { value: 3600, label: '60 min' },
              ]} />
              <Button type="button" onClick={() => void handleSaveMiscLang()} disabled={miscLangMutation.isPending}>
                {t('common.save')}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
