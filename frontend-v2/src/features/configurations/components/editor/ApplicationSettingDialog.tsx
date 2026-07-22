import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ConfigurationApplication } from '@/features/configurations/types/configuration'
import type { ApplicationSetting } from '@/features/configurations/types/configuration'
import { ConfigurationAppSearchInput } from '@/features/configurations/components/editor/ConfigurationAppSearchInput'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { BoolField } from '@/shared/components/BoolField'

interface ApplicationSettingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  setting: ApplicationSetting | null
  applications: ConfigurationApplication[]
  onSave: (setting: ApplicationSetting) => void
}

export function ApplicationSettingDialog({
  open,
  onOpenChange,
  setting,
  applications,
  onSave,
}: ApplicationSettingDialogProps) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState<ApplicationSetting>({})
  const [selectedApp, setSelectedApp] = useState<ConfigurationApplication | undefined>()
  const [error, setError] = useState<string | undefined>()

  const repoApps = useMemo(
    () => applications.filter((app) => app.type === 'app' && app.id != null),
    [applications]
  )

  useEffect(() => {
    if (!open) {
      return
    }
    setDraft(setting ? { ...setting } : { type: 'STRING' })
    if (setting?.applicationId) {
      setSelectedApp(
        repoApps.find((app) => app.id === setting.applicationId) ?? {
          id: setting.applicationId,
          name: setting.applicationName ?? '',
          pkg: setting.applicationPkg,
        }
      )
    } else {
      setSelectedApp(undefined)
    }
    setError(undefined)
  }, [open, setting, repoApps])

  const handleSave = () => {
    if (!draft.name?.trim()) {
      setError(t('configurations.editor.appSettings.errorName'))
      return
    }
    if (!selectedApp?.id) {
      setError(t('configurations.editor.appSettings.errorApp'))
      return
    }

    onSave({
      ...draft,
      applicationId: selectedApp.id,
      applicationName: selectedApp.name,
      applicationPkg: selectedApp.pkg,
      lastUpdate: Date.now(),
      type: draft.type ?? 'STRING',
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {setting?.id || setting?.tempId
              ? t('configurations.editor.appSettings.editTitle')
              : t('configurations.editor.appSettings.addTitle')}
          </DialogTitle>
          <DialogDescription>{t('configurations.editor.appSettings.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t('configurations.editor.appSettings.application')}</Label>
            <ConfigurationAppSearchInput
              id="app-setting-app"
              apps={applications}
              selected={selectedApp}
              mode="repository"
              onSelect={setSelectedApp}
              placeholder={t('configurations.editor.searchApplication')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="setting-name">{t('configurations.editor.appSettings.name')}</Label>
            <Input
              id="setting-name"
              value={draft.name ?? ''}
              onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="setting-value">{t('configurations.editor.appSettings.value')}</Label>
            <Textarea
              id="setting-value"
              value={draft.value ?? ''}
              onChange={(e) => setDraft((prev) => ({ ...prev, value: e.target.value }))}
              rows={4}
              className="resize-none font-mono text-xs"
            />
          </div>

          <BoolField
            id="setting-variable"
            label={t('configurations.editor.appSettings.variable')}
            hint={t('configurations.editor.appSettings.variableHint')}
            checked={draft.variable === true}
            onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, variable: checked }))}
          />

          <div className="space-y-2">
            <Label htmlFor="setting-comment">{t('configurations.editor.appSettings.comment')}</Label>
            <Textarea
              id="setting-comment"
              value={draft.comment ?? ''}
              onChange={(e) => setDraft((prev) => ({ ...prev, comment: e.target.value }))}
              rows={3}
              className="resize-none"
            />
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="button" onClick={handleSave}>
            {t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
