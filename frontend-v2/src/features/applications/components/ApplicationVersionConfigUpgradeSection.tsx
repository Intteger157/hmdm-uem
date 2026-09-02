import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  fetchApplicationConfigurations,
  type ApplicationConfigurationLink,
} from '@/features/applications/api/applications-api'

interface ApplicationVersionConfigUpgradeSectionProps {
  applicationId: number | undefined
  newVersionLabel: string | undefined
  selectedConfigurationIds: number[]
  onSelectedConfigurationIdsChange: (ids: number[]) => void
  notifyDevices: boolean
  onNotifyDevicesChange: (notify: boolean) => void
}

function isInstalledLink(link: ApplicationConfigurationLink): boolean {
  return link.action === 1
}

export function ApplicationVersionConfigUpgradeSection({
  applicationId,
  newVersionLabel,
  selectedConfigurationIds,
  onSelectedConfigurationIdsChange,
  notifyDevices,
  onNotifyDevicesChange,
}: ApplicationVersionConfigUpgradeSectionProps) {
  const { t } = useTranslation()
  const [links, setLinks] = useState<ApplicationConfigurationLink[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    if (applicationId == null) {
      setLinks([])
      return
    }

    let cancelled = false
    setLoading(true)
    setLoadError(false)

    void fetchApplicationConfigurations({ id: applicationId })
      .then((data) => {
        if (cancelled) {
          return
        }
        const installed = data.filter(isInstalledLink)
        setLinks(installed)
        onSelectedConfigurationIdsChange(
          installed.filter((link) => link.outdated).map((link) => link.configurationId!)
        )
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError(true)
          setLinks([])
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
    // Pre-select outdated configs only when applicationId changes (dialog opened for another app).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationId])

  const sortedLinks = useMemo(
    () => [...links].sort((a, b) => (a.configurationName ?? '').localeCompare(b.configurationName ?? '')),
    [links]
  )

  const toggleConfig = (configurationId: number, checked: boolean) => {
    if (checked) {
      onSelectedConfigurationIdsChange([...selectedConfigurationIds, configurationId])
    } else {
      onSelectedConfigurationIdsChange(
        selectedConfigurationIds.filter((id) => id !== configurationId)
      )
    }
  }

  const selectOutdated = () => {
    onSelectedConfigurationIdsChange(
      sortedLinks.filter((link) => link.outdated).map((link) => link.configurationId!)
    )
  }

  const selectAll = () => {
    onSelectedConfigurationIdsChange(sortedLinks.map((link) => link.configurationId!))
  }

  const clearSelection = () => {
    onSelectedConfigurationIdsChange([])
  }

  if (applicationId == null) {
    return null
  }

  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
      <div>
        <p className="text-sm font-medium">{t('applications.versions.upgradeConfigurationsTitle')}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {t('applications.versions.upgradeConfigurationsDescription', {
            version: newVersionLabel ?? '—',
          })}
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
      ) : loadError ? (
        <p className="text-sm text-destructive">{t('applications.versions.upgradeConfigurationsLoadError')}</p>
      ) : sortedLinks.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('applications.versions.upgradeConfigurationsEmpty')}</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="text-xs text-primary underline-offset-2 hover:underline"
              onClick={selectOutdated}
            >
              {t('applications.versions.upgradeSelectOutdated')}
            </button>
            <button
              type="button"
              className="text-xs text-primary underline-offset-2 hover:underline"
              onClick={selectAll}
            >
              {t('applications.versions.upgradeSelectAll')}
            </button>
            <button
              type="button"
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
              onClick={clearSelection}
            >
              {t('applications.versions.upgradeSelectNone')}
            </button>
          </div>

          <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border bg-background p-2">
            {sortedLinks.map((link) => {
              const configId = link.configurationId!
              const checked = selectedConfigurationIds.includes(configId)

              return (
                <label
                  key={configId}
                  className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50"
                >
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={checked}
                    onChange={(e) => toggleConfig(configId, e.target.checked)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">{link.configurationName ?? configId}</span>
                    {link.outdated ? (
                      <span className="mt-0.5 block text-xs text-amber-700 dark:text-amber-300">
                        {t('applications.configurations.outdatedVersion', {
                          current: link.currentVersionText ?? '—',
                          latest: link.latestVersionText ?? newVersionLabel ?? '—',
                        })}
                      </span>
                    ) : (
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {t('applications.versions.upgradeCurrentVersion', {
                          version: link.currentVersionText ?? '—',
                        })}
                      </span>
                    )}
                  </span>
                </label>
              )
            })}
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={notifyDevices}
              disabled={selectedConfigurationIds.length === 0}
              onChange={(e) => onNotifyDevicesChange(e.target.checked)}
            />
            {t('applications.versions.upgradeNotifyDevices')}
          </label>
        </>
      )}
    </div>
  )
}
