import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { ApplicationFormDialog } from '@/features/applications/components/ApplicationFormDialog'
import {
  useApplicationQuery,
  useApplicationVersionsQuery,
  useDeleteApplicationVersionMutation,
} from '@/features/applications/hooks/use-applications'
import type { ApplicationVersion } from '@/features/applications/api/applications-api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmDeleteDialog } from '@/shared/components/ConfirmDeleteDialog'
import { toast } from 'sonner'

interface ApplicationVersionsPageProps {
  applicationId: number
}

function VersionUrlCell({ version }: { version: ApplicationVersion }) {
  const { t } = useTranslation()

  if (version.split) {
    return (
      <div className="space-y-1 text-xs">
        <div>
          <span className="text-muted-foreground">arm64:</span>{' '}
          {version.urlArm64 ?? (
            <span className="text-amber-700 dark:text-amber-300">
              {t('applications.versions.noApk')}
            </span>
          )}
        </div>
        <div>
          <span className="text-muted-foreground">armeabi:</span>{' '}
          {version.urlArmeabi ?? (
            <span className="text-amber-700 dark:text-amber-300">
              {t('applications.versions.noApk')}
            </span>
          )}
        </div>
      </div>
    )
  }

  return <span className="break-all text-xs">{version.url ?? '—'}</span>
}

export function ApplicationVersionsPage({ applicationId }: ApplicationVersionsPageProps) {
  const { t } = useTranslation()
  const { data: application, isLoading: appLoading, error: appError } =
    useApplicationQuery(applicationId)
  const {
    data: versions,
    isLoading: versionsLoading,
    error: versionsError,
    refetch,
  } = useApplicationVersionsQuery(applicationId)
  const deleteMutation = useDeleteApplicationVersionMutation(applicationId)

  const [addOpen, setAddOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ApplicationVersion | null>(null)

  const isLoading = appLoading || versionsLoading
  const error = appError ?? versionsError
  const latestVersionId = application?.latestVersion

  const handleDeleteVersion = async () => {
    if (!deleteTarget?.id) {
      return
    }

    try {
      await deleteMutation.mutateAsync(deleteTarget.id)
      toast.success(t('applications.versions.deleteSuccess'))
      setDeleteTarget(null)
    } catch {
      toast.error(
        deleteTarget.deletionProhibited
          ? t('applications.versions.deleteInUse')
          : t('applications.versions.deleteError')
      )
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  if (error != null || !application) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-card p-8 text-center">
        <p className="text-sm text-destructive">{t('common.loadError')}</p>
        <Button type="button" variant="outline" className="mt-3" render={<Link to="/applications" />}>
          {t('applications.versions.backToList')}
        </Button>
      </div>
    )
  }

  const sortedVersions = [...(versions ?? [])].sort((a, b) => {
    const codeA = a.versionCode ?? 0
    const codeB = b.versionCode ?? 0
    if (codeA !== codeB) {
      return codeB - codeA
    }
    return (b.version ?? '').localeCompare(a.version ?? '')
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button type="button" variant="ghost" size="icon-sm" render={<Link to="/applications" />}>
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{application.name}</h1>
            <p className="font-mono text-sm text-muted-foreground">{application.pkg ?? '—'}</p>
          </div>
        </div>
        {application.type !== 'web' && (
          <Button type="button" onClick={() => setAddOpen(true)}>
            <Plus className="size-4" />
            {t('applications.versions.addVersion')}
          </Button>
        )}
      </div>

      <p className="text-sm text-muted-foreground">{t('applications.versions.description')}</p>

      {sortedVersions.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
          {t('applications.versions.empty')}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">{t('applications.columns.version')}</th>
                <th className="px-4 py-3 font-medium">{t('applications.versions.versionCode')}</th>
                <th className="px-4 py-3 font-medium">{t('applications.versions.urlColumn')}</th>
                <th className="px-4 py-3 font-medium text-right">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {sortedVersions.map((version) => {
                const isLatest = version.id != null && version.id === latestVersionId

                return (
                  <tr key={version.id} className="border-b last:border-b-0 hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{version.version ?? '—'}</span>
                        {isLatest && (
                          <Badge variant="secondary">{t('applications.versions.latest')}</Badge>
                        )}
                      </div>
                      {version.id != null && (
                        <span className="text-xs text-muted-foreground">
                          {t('applications.versions.versionId', { id: version.id })}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {version.versionCode != null && version.versionCode !== 0
                        ? version.versionCode
                        : '—'}
                    </td>
                    <td className="px-4 py-3 max-w-md">
                      <VersionUrlCell version={version} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          title={
                            version.deletionProhibited
                              ? t('applications.versions.deleteInUse')
                              : t('common.delete')
                          }
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(version)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <ApplicationFormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        closeOnSave
        parentApplication={application}
        onSavedApplication={() => {
          void refetch()
        }}
      />

      <ConfirmDeleteDialog
        open={deleteTarget != null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null)
          }
        }}
        title={t('applications.versions.deleteTitle')}
        description={
          deleteTarget?.deletionProhibited
            ? t('applications.versions.deleteInUseConfirm', {
                version: deleteTarget.version ?? '',
              })
            : t('applications.versions.deleteConfirm', { version: deleteTarget?.version ?? '' })
        }
        isPending={deleteMutation.isPending}
        onConfirm={() => void handleDeleteVersion()}
      />
    </div>
  )
}
