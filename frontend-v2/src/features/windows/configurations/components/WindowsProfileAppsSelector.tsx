import { useTranslation } from 'react-i18next'
import type { ProfileAppAssignment, SoftwareApp } from '@/features/windows/applications/types/software-app'
import { Label } from '@/components/ui/label'

interface WindowsProfileAppsSelectorProps {
  apps: SoftwareApp[]
  assignments: ProfileAppAssignment[]
  onChange: (assignments: ProfileAppAssignment[]) => void
  disabled?: boolean
}

export function WindowsProfileAppsSelector({
  apps,
  assignments,
  onChange,
  disabled = false,
}: WindowsProfileAppsSelectorProps) {
  const { t } = useTranslation()

  const selectedIds = assignments.map((item) => item.appId)

  const toggleApp = (appId: number) => {
    if (selectedIds.includes(appId)) {
      onChange(assignments.filter((item) => item.appId !== appId))
      return
    }
    onChange([...assignments, { appId }])
  }

  const setVersion = (appId: number, versionId: number | null) => {
    onChange(
      assignments.map((item) =>
        item.appId === appId ? { ...item, versionId: versionId ?? undefined } : item,
      ),
    )
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>{t('windowsConfigurations.requiredApps.apps')}</Label>
        <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border p-3">
          {apps.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('windowsConfigurations.requiredApps.noApps')}</p>
          ) : (
            apps.map((app) => (
              <label key={app.id} className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(app.id)}
                  disabled={disabled}
                  onChange={() => toggleApp(app.id)}
                />
                <span>{app.name}</span>
                <span className="text-xs text-muted-foreground">({app.latestVersion || '—'})</span>
              </label>
            ))
          )}
        </div>
      </div>

      {assignments.length > 0 ? (
        <div className="space-y-3">
          <Label>{t('windowsConfigurations.requiredApps.versionPolicy')}</Label>
          {assignments.map((assignment) => {
            const app = apps.find((item) => item.id === assignment.appId)
            if (!app) {
              return null
            }
            const value =
              assignment.versionId == null || assignment.versionId === 0
                ? 'latest'
                : String(assignment.versionId)
            return (
              <div key={assignment.appId} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                <span className="min-w-32 text-sm font-medium">{app.name}</span>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:max-w-xs"
                  value={value}
                  disabled={disabled}
                  onChange={(event) => {
                    const next = event.target.value
                    setVersion(assignment.appId, next === 'latest' ? null : Number.parseInt(next, 10))
                  }}
                >
                  <option value="latest">
                    {t('windowsConfigurations.requiredApps.latestVersion', {
                      version: app.latestVersion || '—',
                    })}
                  </option>
                  {app.versions.map((version) => (
                    <option key={version.id} value={String(version.id)}>
                      {version.version || `#${version.id}`}
                    </option>
                  ))}
                </select>
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
