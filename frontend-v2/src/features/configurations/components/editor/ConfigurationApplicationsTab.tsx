import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Info } from 'lucide-react'
import { AddConfigurationApplicationDialog } from '@/features/configurations/components/editor/AddConfigurationApplicationDialog'
import { ConfigurationAppDetailsDialog } from '@/features/configurations/components/editor/ConfigurationAppDetailsDialog'
import {
  ConfigurationAppVersionDialog,
  type ConfigurationAppVersionDialogResult,
} from '@/features/configurations/components/editor/ConfigurationAppVersionDialog'
import { useUpgradeConfigurationApplicationMutation } from '@/features/configurations/hooks/use-configurations'
import type { Configuration } from '@/features/configurations/types/configuration'
import type { ConfigurationApplication } from '@/features/configurations/types/configuration'
import type { ConfigurationApplicationParameters } from '@/features/configurations/types/configuration'
import { compareAppVersions } from '@/features/configurations/utils/app-version-utils'
import {
  addAppToConfiguration,
  applyActionChange,
  applyMainAppSelection,
  filterConfigurationTableApps,
  findConfigAppByUsedVersionId,
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
import {
  applyVersionSelection,
  mergeApplicationUsageParameters,
} from '@/features/configurations/utils/configuration-version-utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ConfirmDeleteDialog } from '@/shared/components/ConfirmDeleteDialog'
import { toast } from 'sonner'

interface ConfigurationApplicationsTabProps {
  configId: number
  draft: Configuration
  applications: ConfigurationApplication[]
  onChange: (patch: Partial<Configuration>) => void
  onApplicationsChange: (applications: ConfigurationApplication[]) => void
  onApplicationsReload?: () => void
}

export function ConfigurationApplicationsTab({
  configId,
  draft,
  applications,
  onChange,
  onApplicationsChange,
  onApplicationsReload,
}: ConfigurationApplicationsTabProps) {
  const { t } = useTranslation()
  const upgradeMutation = useUpgradeConfigurationApplicationMutation()

  const [showSystemApps, setShowSystemApps] = useState(getShowSystemAppsPreference)
  const [sortBy, setSortBy] = useState<ConfigurationAppSortBy>(getConfigurationAppsSortPreference)
  const [searchText, setSearchText] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [versionApp, setVersionApp] = useState<ConfigurationApplication | null>(null)
  const [detailsApp, setDetailsApp] = useState<ConfigurationApplication | null>(null)
  const [upgradeTarget, setUpgradeTarget] = useState<ConfigurationApplication | null>(null)
  const [pendingVersion, setPendingVersion] = useState<{
    app: ConfigurationApplication
    data: ConfigurationAppVersionDialogResult
    comparison: number
  } | null>(null)

  const usageParameters = draft.applicationUsageParameters ?? []
  const mainApp = findConfigAppByUsedVersionId(applications, draft.mainAppId ?? undefined)
  const contentApp = findConfigAppByUsedVersionId(applications, draft.contentAppId ?? undefined)

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

  const getUsageParameters = (applicationId?: number): ConfigurationApplicationParameters | undefined =>
    usageParameters.find((item) => item.applicationId === applicationId)

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

  const commitVersionChange = (
    app: ConfigurationApplication,
    data: ConfigurationAppVersionDialogResult
  ) => {
    const nextUsage = mergeApplicationUsageParameters(usageParameters, data.applicationParameters)
    const result = applyVersionSelection(applications, app, data, {
      mainAppId: draft.mainAppId,
      contentAppId: draft.contentAppId,
      mainAppPkg: mainApp?.pkg,
      contentAppPkg: contentApp?.pkg,
    })

    onChange({
      applicationUsageParameters: nextUsage,
      mainAppId: result.mainAppId,
      contentAppId: result.contentAppId,
    })
    onApplicationsChange(result.applications)
  }

  const handleVersionApply = (data: ConfigurationAppVersionDialogResult) => {
    if (!versionApp) {
      return
    }

    const current = data.availableVersions.find((v) => v.id === versionApp.usedVersionId)
    const selected = data.availableVersions.find((v) => v.id === data.selectedVersionId)
    const comparison = compareAppVersions(selected?.version, current?.version)

    if (comparison === 0) {
      onChange({
        applicationUsageParameters: mergeApplicationUsageParameters(
          usageParameters,
          data.applicationParameters
        ),
      })
      return
    }

    setPendingVersion({ app: versionApp, data, comparison })
  }

  const handleConfirmVersionChange = () => {
    if (!pendingVersion) {
      return
    }
    commitVersionChange(pendingVersion.app, pendingVersion.data)
    setPendingVersion(null)
  }

  const handleUpgrade = async () => {
    if (!upgradeTarget?.id) {
      return
    }

    try {
      const updated = await upgradeMutation.mutateAsync({
        configurationId: configId,
        applicationId: upgradeTarget.id,
      })
      onChange({
        mainAppId: updated.mainAppId,
        contentAppId: updated.contentAppId,
      })
      onApplicationsReload?.()
      toast.success(t('configurations.editor.upgrade.success'))
      setUpgradeTarget(null)
    } catch {
      toast.error(t('configurations.editor.upgrade.error'))
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
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="border-b bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium w-12">{t('configurations.editor.mainApp')}</th>
                    <th className="px-4 py-3 font-medium">{t('applications.columns.name')}</th>
                    <th className="px-4 py-3 font-medium">{t('applications.columns.version')}</th>
                    <th className="px-4 py-3 font-medium">{t('configurations.editor.actionColumn')}</th>
                    <th className="px-4 py-3 font-medium">{t('configurations.editor.iconColumn')}</th>
                    <th className="px-4 py-3 font-medium">{t('configurations.editor.orderColumn')}</th>
                    <th className="px-4 py-3 font-medium text-right">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleApps.map((app) => {
                    const versionId = app.usedVersionId
                    const isMain = versionId != null && draft.mainAppId === versionId
                    const canBeMain = app.type === 'app' && app.action === 1
                    const installAvailable = isInstallOptionAvailable(app)
                    const removeAvailable = isRemoveOptionAvailable(app)
                    const canEditDetails = app.action === 1 && app.showIcon === true

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
                        <td className="px-4 py-3">
                          {app.action === 1 ? (
                            <div className="space-y-1">
                              <button
                                type="button"
                                className="text-primary underline-offset-4 hover:underline"
                                onClick={() => setVersionApp(app)}
                              >
                                {app.version ?? '—'}
                              </button>
                              {app.outdated && (
                                <div>
                                  <button
                                    type="button"
                                    className="text-xs text-amber-700 underline-offset-4 hover:underline dark:text-amber-300"
                                    disabled={upgradeMutation.isPending}
                                    onClick={() => setUpgradeTarget(app)}
                                  >
                                    {t('configurations.editor.upgrade.action')}
                                  </button>
                                </div>
                              )}
                            </div>
                          ) : (
                            app.version ?? '—'
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <select
                            className="flex h-9 min-w-[120px] rounded-md border border-input bg-transparent px-2 text-sm"
                            value={app.action ?? 0}
                            onChange={(e) => handleActionChange(app, Number(e.target.value))}
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
                              onChange={(e) => handleShowIconChange(app, e.target.value === '1')}
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
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end">
                            {canEditDetails && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-xs"
                                title={t('configurations.editor.appDetails.action')}
                                onClick={() => setDetailsApp(app)}
                              >
                                <Info className="size-3.5" />
                              </Button>
                            )}
                          </div>
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

      <ConfigurationAppVersionDialog
        open={versionApp != null}
        onOpenChange={(open) => {
          if (!open) {
            setVersionApp(null)
          }
        }}
        application={versionApp}
        applicationParameters={getUsageParameters(versionApp?.id)}
        onApply={handleVersionApply}
      />

      <ConfigurationAppDetailsDialog
        open={detailsApp != null}
        onOpenChange={(open) => {
          if (!open) {
            setDetailsApp(null)
          }
        }}
        application={detailsApp}
        onSave={(updated) => {
          onApplicationsChange(updateConfigurationApplication(applications, updated))
        }}
      />

      <ConfirmDeleteDialog
        open={upgradeTarget != null}
        onOpenChange={(open) => {
          if (!open) {
            setUpgradeTarget(null)
          }
        }}
        title={t('configurations.editor.upgrade.title')}
        description={t('configurations.editor.upgrade.confirm', {
          app: upgradeTarget?.name ?? '',
          config: draft.name,
        })}
        confirmLabel={t('configurations.editor.upgrade.action')}
        confirmVariant="default"
        pendingLabel={t('common.saving')}
        isPending={upgradeMutation.isPending}
        onConfirm={() => void handleUpgrade()}
      />

      <ConfirmDeleteDialog
        open={pendingVersion != null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingVersion(null)
          }
        }}
        title={t('configurations.editor.versionDialog.confirmTitle')}
        description={
          pendingVersion?.comparison != null && pendingVersion.comparison > 0
            ? t('configurations.editor.versionDialog.upgradeWarning', {
                app: pendingVersion.app.name,
                config: draft.name,
                version:
                  pendingVersion.data.availableVersions.find(
                    (v) => v.id === pendingVersion.data.selectedVersionId
                  )?.version ?? '',
              })
            : t('configurations.editor.versionDialog.downgradeWarning', {
                app: pendingVersion?.app.name ?? '',
                version:
                  pendingVersion?.data.availableVersions.find(
                    (v) => v.id === pendingVersion?.data.selectedVersionId
                  )?.version ?? '',
              })
        }
        confirmLabel={t('configurations.editor.versionDialog.apply')}
        confirmVariant="default"
        onConfirm={handleConfirmVersionChange}
      />
    </>
  )
}
