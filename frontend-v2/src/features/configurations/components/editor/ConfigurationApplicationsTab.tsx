import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AddConfigurationApplicationDialog } from '@/features/configurations/components/editor/AddConfigurationApplicationDialog'
import type { Configuration } from '@/features/configurations/types/configuration'
import type { ConfigurationApplication } from '@/features/configurations/types/configuration'
import {
  addAppToConfiguration,
  applyActionChange,
  applyMainAppSelection,
  filterConfigurationTableApps,
  getConfigurationAppsSortPreference,
  getShowSystemAppsPreference,
  isInstallOptionAvailable,
  isRemoveOptionAvailable,
  pkgInfoVisible,
  setConfigurationAppsSortPreference,
  setShowSystemAppsPreference,
  type ConfigurationAppSortBy,
  updateConfigurationApplication,
} from '@/features/configurations/utils/configuration-app-utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

interface ConfigurationApplicationsTabProps {
  draft: Configuration
  applications: ConfigurationApplication[]
  onChange: (patch: Partial<Configuration>) => void
  onApplicationsChange: (applications: ConfigurationApplication[]) => void
}

export function ConfigurationApplicationsTab({
  draft,
  applications,
  onChange,
  onApplicationsChange,
}: ConfigurationApplicationsTabProps) {
  const { t } = useTranslation()
  const [showSystemApps, setShowSystemApps] = useState(getShowSystemAppsPreference)
  const [sortBy, setSortBy] = useState<ConfigurationAppSortBy>(getConfigurationAppsSortPreference)
  const [searchText, setSearchText] = useState('')
  const [addOpen, setAddOpen] = useState(false)

  const visibleApps = useMemo(
    () =>
      filterConfigurationTableApps(applications, { showSystemApps, searchText }).sort((a, b) => {
        if (sortBy === 'pkg') {
          return (a.pkg ?? '').localeCompare(b.pkg ?? '', undefined, { sensitivity: 'base' })
        }
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      }),
    [applications, showSystemApps, searchText, sortBy]
  )

  const handleShowSystemAppsChange = (checked: boolean) => {
    setShowSystemApps(checked)
    setShowSystemAppsPreference(checked)
  }

  const handleSortChange = (value: ConfigurationAppSortBy) => {
    setSortBy(value)
    setConfigurationAppsSortPreference(value)
  }

  const handleActionChange = (app: ConfigurationApplication, nextAction: number) => {
    onApplicationsChange(applyActionChange(applications, app, nextAction))
  }

  const handleShowIconChange = (app: ConfigurationApplication, showIcon: boolean) => {
    onApplicationsChange(updateConfigurationApplication(applications, { ...app, showIcon }))
  }

  const handleScreenOrderChange = (app: ConfigurationApplication, screenOrder: string) => {
    const parsed = screenOrder.trim() === '' ? undefined : Number(screenOrder)
    onApplicationsChange(
      updateConfigurationApplication(applications, {
        ...app,
        screenOrder: Number.isFinite(parsed) ? parsed : undefined,
      })
    )
  }

  const handleAddApp = (app: ConfigurationApplication) => {
    const next = addAppToConfiguration(applications, app)
    onApplicationsChange(next)

    if (app.action === 1 && app.pkg === 'com.hmdm.launcher' && app.usedVersionId) {
      onChange({
        mainAppId: app.usedVersionId,
        eventReceivingComponent:
          draft.eventReceivingComponent?.trim() || 'com.hmdm.launcher.AdminReceiver',
      })
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitle>{t('configurations.editor.applicationsTitle')}</CardTitle>
            <CardDescription>{t('configurations.editor.applicationsDescription')}</CardDescription>
          </div>
          <Button type="button" onClick={() => setAddOpen(true)}>
            {t('common.add')}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span className="text-muted-foreground">{t('configurations.editor.sortLabel')}</span>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="config-apps-sort"
                checked={sortBy === 'pkg'}
                onChange={() => handleSortChange('pkg')}
              />
              {t('configurations.editor.sortByPkg')}
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="config-apps-sort"
                checked={sortBy === 'name'}
                onChange={() => handleSortChange('name')}
              />
              {t('configurations.editor.sortByName')}
            </label>
            <label className="ml-auto flex items-center gap-2">
              <input
                type="checkbox"
                checked={showSystemApps}
                onChange={(e) => handleShowSystemAppsChange(e.target.checked)}
              />
              {t('configurations.editor.showSystemApps')}
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">{t('common.search')}</span>
            <Input
              className="max-w-md"
              value={searchText}
              placeholder={t('configurations.editor.searchApplication')}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </div>

          {visibleApps.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('configurations.editor.noApplications')}</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="border-b bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium w-12">{t('configurations.editor.mainApp')}</th>
                    <th className="px-4 py-3 font-medium">{t('applications.columns.name')}</th>
                    <th className="px-4 py-3 font-medium">{t('applications.columns.version')}</th>
                    <th className="px-4 py-3 font-medium">{t('configurations.editor.actionColumn')}</th>
                    <th className="px-4 py-3 font-medium">{t('configurations.editor.iconColumn')}</th>
                    <th className="px-4 py-3 font-medium">{t('configurations.editor.orderColumn')}</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleApps.map((app) => {
                    const versionId = app.usedVersionId
                    const isMain = versionId != null && draft.mainAppId === versionId
                    const canBeMain = app.type === 'app' && app.action === 1
                    const installAvailable = isInstallOptionAvailable(app)
                    const removeAvailable = isRemoveOptionAvailable(app)

                    return (
                      <tr
                        key={`${app.id}-${versionId ?? 'na'}-${app.pkg ?? app.name}`}
                        className="border-b last:border-b-0"
                      >
                        <td className="px-4 py-3">
                          {canBeMain && (
                            <input
                              type="radio"
                              name="mainApp"
                              checked={isMain}
                              disabled={versionId == null}
                              onChange={() => {
                                if (versionId == null) return
                                onApplicationsChange(applyMainAppSelection(applications, app))
                                onChange({
                                  mainAppId: versionId,
                                  eventReceivingComponent:
                                    draft.eventReceivingComponent?.trim() ||
                                    (app.pkg === 'com.hmdm.launcher'
                                      ? 'com.hmdm.launcher.AdminReceiver'
                                      : draft.eventReceivingComponent),
                                })
                              }}
                            />
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium">{app.name}</div>
                          {pkgInfoVisible(app) && app.pkg && (
                            <div className="font-mono text-xs text-muted-foreground">{app.pkg}</div>
                          )}
                        </td>
                        <td className="px-4 py-3">{app.version ?? '—'}</td>
                        <td className="px-4 py-3">
                          <select
                            className="flex h-9 min-w-[120px] rounded-md border border-input bg-transparent px-2 text-sm"
                            value={app.action ?? 0}
                            onChange={(e) =>
                              handleActionChange(app, Number(e.target.value))
                            }
                          >
                            <option value={1}>
                              {installAvailable
                                ? t('configurations.editor.actionInstall')
                                : t('configurations.editor.actionAllow')}
                            </option>
                            <option value={0}>
                              {installAvailable
                                ? t('configurations.editor.actionNotInstall')
                                : t('configurations.editor.actionProhibit')}
                            </option>
                            {removeAvailable && (
                              <option value={2}>{t('configurations.editor.actionRemove')}</option>
                            )}
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          {app.action === 1 ? (
                            <select
                              className="flex h-9 min-w-[100px] rounded-md border border-input bg-transparent px-2 text-sm"
                              value={app.showIcon ? '1' : '0'}
                              onChange={(e) =>
                                handleShowIconChange(app, e.target.value === '1')
                              }
                            >
                              <option value="1">{t('configurations.editor.showIconOption')}</option>
                              <option value="0">{t('configurations.editor.hideIconOption')}</option>
                            </select>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {app.action === 1 && app.showIcon ? (
                            <Input
                              className="w-20"
                              type="number"
                              value={app.screenOrder ?? ''}
                              onChange={(e) => handleScreenOrderChange(app, e.target.value)}
                            />
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {draft.mainAppId == null && visibleApps.some((app) => app.action === 1) && (
            <p className="text-sm text-amber-700 dark:text-amber-300">
              {t('configurations.editor.noMainAppWarning')}
            </p>
          )}

          {!showSystemApps && (
            <p className="text-xs text-muted-foreground">
              {t('configurations.editor.systemAppsHiddenHint')}
            </p>
          )}
        </CardContent>
      </Card>

      <AddConfigurationApplicationDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        configuration={draft}
        applications={applications}
        onAdd={handleAddApp}
      />
    </>
  )
}
