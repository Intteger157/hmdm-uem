import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { ApplicationSettingDialog } from '@/features/configurations/components/editor/ApplicationSettingDialog'
import type { Configuration } from '@/features/configurations/types/configuration'
import type { ApplicationSetting } from '@/features/configurations/types/configuration'
import type { ConfigurationApplication } from '@/features/configurations/types/configuration'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ConfirmDeleteDialog } from '@/shared/components/ConfirmDeleteDialog'

interface ConfigurationAppSettingsTabProps {
  draft: Configuration
  applications: ConfigurationApplication[]
  onChange: (patch: Partial<Configuration>) => void
}

function settingKey(setting: ApplicationSetting): string {
  return String(setting.id ?? setting.tempId ?? `${setting.applicationPkg}-${setting.name}`)
}

export function ConfigurationAppSettingsTab({
  draft,
  applications,
  onChange,
}: ConfigurationAppSettingsTabProps) {
  const { t } = useTranslation()
  const [appFilter, setAppFilter] = useState('')
  const [textFilter, setTextFilter] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingSetting, setEditingSetting] = useState<ApplicationSetting | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ApplicationSetting | null>(null)

  const settings = draft.applicationSettings ?? []

  const visibleSettings = useMemo(() => {
    const appQuery = appFilter.trim().toLowerCase()
    const textQuery = textFilter.trim().toLowerCase()

    return settings
      .filter((setting) => {
        if (appQuery && !(setting.applicationPkg ?? '').toLowerCase().includes(appQuery)) {
          return false
        }
        if (!textQuery) {
          return true
        }
        return (
          (setting.name ?? '').toLowerCase().includes(textQuery) ||
          (setting.value ?? '').toLowerCase().includes(textQuery) ||
          (setting.comment ?? '').toLowerCase().includes(textQuery)
        )
      })
      .sort((a, b) => (a.applicationPkg ?? '').localeCompare(b.applicationPkg ?? ''))
  }, [settings, appFilter, textFilter])

  const updateSettings = useCallback(
    (next: ApplicationSetting[]) => onChange({ applicationSettings: next }),
    [onChange]
  )

  const handleSaveSetting = (setting: ApplicationSetting) => {
    const index = settings.findIndex((item) => {
      if (setting.id && item.id) {
        return item.id === setting.id
      }
      if (setting.tempId && item.tempId) {
        return item.tempId === setting.tempId
      }
      return false
    })

    if (index >= 0) {
      const next = [...settings]
      next[index] = setting
      updateSettings(next)
    } else {
      updateSettings([...settings, { ...setting, tempId: setting.tempId ?? Date.now() }])
    }
  }

  const handleDelete = () => {
    if (!deleteTarget) {
      return
    }
    updateSettings(
      settings.filter((item) => {
        if (deleteTarget.id && item.id) {
          return item.id !== deleteTarget.id
        }
        if (deleteTarget.tempId && item.tempId) {
          return item.tempId !== deleteTarget.tempId
        }
        return true
      })
    )
    setDeleteTarget(null)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('configurations.editor.appSettingsTitle')}</CardTitle>
        <CardDescription>{t('configurations.editor.appSettingsDescription')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            value={appFilter}
            onChange={(e) => setAppFilter(e.target.value)}
            placeholder={t('configurations.editor.appSettings.filterApp')}
            className="sm:max-w-xs"
          />
          <Input
            value={textFilter}
            onChange={(e) => setTextFilter(e.target.value)}
            placeholder={t('configurations.editor.appSettings.filterText')}
            className="flex-1"
          />
          <Button
            type="button"
            className="shrink-0"
            onClick={() => {
              setEditingSetting(null)
              setDialogOpen(true)
            }}
          >
            <Plus className="mr-1 size-4" />
            {t('common.add')}
          </Button>
        </div>

        {visibleSettings.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('configurations.editor.appSettings.empty')}</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead className="border-b bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">{t('configurations.editor.appSettings.columns.pkg')}</th>
                  <th className="px-4 py-3 font-medium">{t('configurations.editor.appSettings.columns.app')}</th>
                  <th className="px-4 py-3 font-medium">{t('configurations.editor.appSettings.columns.name')}</th>
                  <th className="px-4 py-3 font-medium">{t('configurations.editor.appSettings.columns.value')}</th>
                  <th className="px-4 py-3 font-medium">{t('configurations.editor.appSettings.columns.comment')}</th>
                  <th className="px-4 py-3 font-medium text-right">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {visibleSettings.map((setting) => (
                  <tr key={settingKey(setting)} className="border-b last:border-b-0">
                    <td className="px-4 py-3 font-mono text-xs">{setting.applicationPkg ?? '—'}</td>
                    <td className="px-4 py-3">{setting.applicationName ?? '—'}</td>
                    <td className="px-4 py-3">{setting.name ?? '—'}</td>
                    <td className="px-4 py-3 max-w-xs truncate">{setting.value ?? '—'}</td>
                    <td className="px-4 py-3 max-w-xs truncate text-muted-foreground">
                      {setting.comment ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => {
                            setEditingSetting(setting)
                            setDialogOpen(true)
                          }}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(setting)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <ApplicationSettingDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        setting={editingSetting}
        applications={applications}
        onSave={handleSaveSetting}
      />

      <ConfirmDeleteDialog
        open={deleteTarget != null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null)
          }
        }}
        title={t('configurations.editor.appSettings.deleteTitle')}
        description={t('configurations.editor.appSettings.deleteConfirm', {
          name: deleteTarget?.name ?? '',
        })}
        onConfirm={handleDelete}
      />
    </Card>
  )
}
