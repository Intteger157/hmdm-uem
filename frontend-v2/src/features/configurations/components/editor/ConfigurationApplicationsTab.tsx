import { useTranslation } from 'react-i18next'
import type { Configuration } from '@/features/configurations/types/configuration'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface ConfigurationApplicationsTabProps {
  draft: Configuration
  onChange: (patch: Partial<Configuration>) => void
}

export function ConfigurationApplicationsTab({ draft, onChange }: ConfigurationApplicationsTabProps) {
  const { t } = useTranslation()
  const applications = draft.applications ?? []

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('configurations.editor.applicationsTitle')}</CardTitle>
        <CardDescription>{t('configurations.editor.applicationsDescription')}</CardDescription>
      </CardHeader>
      <CardContent>
        {applications.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('configurations.editor.noApplications')}</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium w-12">{t('configurations.editor.mainApp')}</th>
                  <th className="px-4 py-3 font-medium">{t('applications.columns.name')}</th>
                  <th className="px-4 py-3 font-medium">{t('applications.columns.pkg')}</th>
                  <th className="px-4 py-3 font-medium">{t('applications.columns.version')}</th>
                  <th className="px-4 py-3 font-medium">{t('configurations.editor.appFlags')}</th>
                </tr>
              </thead>
              <tbody>
                {applications.map((app) => {
                  const appId = app.id
                  const isMain = appId != null && draft.mainAppId === appId

                  return (
                    <tr key={appId ?? app.pkg ?? app.name} className="border-b last:border-b-0">
                      <td className="px-4 py-3">
                        <input
                          type="radio"
                          name="mainApp"
                          checked={isMain}
                          disabled={appId == null}
                          onChange={() => {
                            if (appId != null) {
                              onChange({ mainAppId: appId })
                            }
                          }}
                        />
                      </td>
                      <td className="px-4 py-3 font-medium">{app.name}</td>
                      <td className="px-4 py-3 font-mono text-xs">{app.pkg ?? '—'}</td>
                      <td className="px-4 py-3">{app.version ?? '—'}</td>
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

        {draft.mainAppId == null && applications.length > 0 && (
          <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">
            {t('configurations.editor.noMainAppWarning')}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
