import { useTranslation } from 'react-i18next'
import type { Configuration } from '@/features/configurations/types/configuration'
import type { ConfigurationApplication } from '@/features/configurations/types/configuration'
import { applyMainAppSelection } from '@/features/configurations/utils/configuration-app-utils'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface ConfigurationApplicationsTabProps {
  draft: Configuration
  applications: ConfigurationApplication[]
  onChange: (patch: Partial<Configuration>) => void
  onApplicationsChange: (applications: ConfigurationApplication[]) => void
}

function actionLabel(action: number | undefined, t: (key: string) => string): string {
  if (action === 1) return t('configurations.editor.actionInstall')
  if (action === 2) return t('configurations.editor.actionRemove')
  if (action != null && action !== 0) return t('configurations.editor.actionAllow')
  return '—'
}

export function ConfigurationApplicationsTab({
  draft,
  applications,
  onChange,
  onApplicationsChange,
}: ConfigurationApplicationsTabProps) {
  const { t } = useTranslation()
  const assignedApps = applications.filter((app) => app.action != null && app.action !== 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('configurations.editor.applicationsTitle')}</CardTitle>
        <CardDescription>{t('configurations.editor.applicationsDescription')}</CardDescription>
      </CardHeader>
      <CardContent>
        {assignedApps.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('configurations.editor.noApplications')}</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium w-12">{t('configurations.editor.mainApp')}</th>
                  <th className="px-4 py-3 font-medium">{t('applications.columns.name')}</th>
                  <th className="px-4 py-3 font-medium">{t('applications.columns.pkg')}</th>
                  <th className="px-4 py-3 font-medium">{t('applications.columns.version')}</th>
                  <th className="px-4 py-3 font-medium">{t('configurations.editor.actionColumn')}</th>
                  <th className="px-4 py-3 font-medium">{t('configurations.editor.appFlags')}</th>
                </tr>
              </thead>
              <tbody>
                {assignedApps.map((app) => {
                  const versionId = app.usedVersionId
                  const isMain = versionId != null && draft.mainAppId === versionId
                  const canBeMain = app.type === 'app' && app.action === 1

                  return (
                    <tr key={versionId ?? app.id ?? app.pkg ?? app.name} className="border-b last:border-b-0">
                      <td className="px-4 py-3">
                        <input
                          type="radio"
                          name="mainApp"
                          checked={isMain}
                          disabled={!canBeMain || versionId == null}
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
                      </td>
                      <td className="px-4 py-3 font-medium">{app.name}</td>
                      <td className="px-4 py-3 font-mono text-xs">{app.pkg ?? '—'}</td>
                      <td className="px-4 py-3">{app.version ?? '—'}</td>
                      <td className="px-4 py-3">{actionLabel(app.action, t)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {app.showIcon && (
                            <Badge variant="secondary">{t('configurations.editor.showIcon')}</Badge>
                          )}
                          {app.useKiosk && (
                            <Badge variant="secondary">{t('configurations.editor.useKiosk')}</Badge>
                          )}
                          {app.system && (
                            <Badge variant="secondary">{t('applications.badges.system')}</Badge>
                          )}
                          {Boolean(app.remove) && (
                            <Badge variant="secondary">{t('configurations.editor.removeApp')}</Badge>
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

        {draft.mainAppId == null && assignedApps.length > 0 && (
          <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">
            {t('configurations.editor.noMainAppWarning')}
          </p>
        )}

        <p className="mt-3 text-xs text-muted-foreground">
          {t('configurations.editor.applicationsManageHint')}
        </p>
      </CardContent>
    </Card>
  )
}
