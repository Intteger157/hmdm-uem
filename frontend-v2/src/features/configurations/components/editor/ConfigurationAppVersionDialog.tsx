import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { fetchApplicationVersions, type ApplicationVersion } from '@/features/applications/api/applications-api'
import type { ConfigurationApplication } from '@/features/configurations/types/configuration'
import type { ConfigurationApplicationParameters } from '@/features/configurations/types/configuration'
import { BoolField } from '@/shared/components/BoolField'
import { FormSelect } from '@/shared/components/FormSelect'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export interface ConfigurationAppVersionDialogResult {
  selectedVersionId: number
  availableVersions: ApplicationVersion[]
  applicationParameters: ConfigurationApplicationParameters
}

interface ConfigurationAppVersionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  application: ConfigurationApplication | null
  applicationParameters?: ConfigurationApplicationParameters
  onApply: (result: ConfigurationAppVersionDialogResult) => void
}

export function ConfigurationAppVersionDialog({
  open,
  onOpenChange,
  application,
  applicationParameters,
  onApply,
}: ConfigurationAppVersionDialogProps) {
  const { t } = useTranslation()
  const [versions, setVersions] = useState<ApplicationVersion[]>([])
  const [selectedVersionId, setSelectedVersionId] = useState<number>(0)
  const [skipVersionCheck, setSkipVersionCheck] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | undefined>()

  useEffect(() => {
    if (!open || !application?.id) {
      return
    }

    setLoading(true)
    setError(undefined)
    setSkipVersionCheck(applicationParameters?.skipVersionCheck === true)
    setSelectedVersionId(application.usedVersionId ?? application.latestVersion ?? 0)

    void fetchApplicationVersions(application.id)
      .then((data) => {
        setVersions(data)
        if (!application.usedVersionId && data[0]?.id) {
          setSelectedVersionId(data[0].id)
        }
      })
      .catch(() => setError(t('common.loadError')))
      .finally(() => setLoading(false))
  }, [open, application, applicationParameters, t])

  const handleApply = () => {
    if (!application?.id || !selectedVersionId) {
      return
    }

    onApply({
      selectedVersionId,
      availableVersions: versions,
      applicationParameters: {
        ...applicationParameters,
        applicationId: application.id,
        skipVersionCheck,
      },
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{application?.name ?? t('configurations.editor.versionDialog.title')}</DialogTitle>
          <DialogDescription>{t('configurations.editor.versionDialog.description')}</DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
        ) : (
          <div className="space-y-4">
            <FormSelect
              id="app-version-select"
              label={t('configurations.editor.versionDialog.version')}
              value={selectedVersionId}
              onChange={(value) => setSelectedVersionId(Number(value))}
              options={versions.map((version) => ({
                value: version.id ?? 0,
                label: version.version ?? String(version.id),
              }))}
            />

            <BoolField
              id="skip-version-check"
              label={t('configurations.editor.versionDialog.skipVersionCheck')}
              checked={skipVersionCheck}
              onCheckedChange={setSkipVersionCheck}
            />

            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="button" disabled={loading || !selectedVersionId} onClick={handleApply}>
            {t('configurations.editor.versionDialog.apply')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
