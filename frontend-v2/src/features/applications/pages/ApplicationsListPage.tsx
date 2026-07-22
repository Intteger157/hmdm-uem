import { Link } from '@tanstack/react-router'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Layers, List, Plus, Trash2 } from 'lucide-react'
import { ApplicationConfigurationsDialog } from '@/features/applications/components/ApplicationConfigurationsDialog'
import { ApplicationFormDialog } from '@/features/applications/components/ApplicationFormDialog'
import {
  useApplicationsQuery,
  useDeleteApplicationMutation,
} from '@/features/applications/hooks/use-applications'
import type { Application } from '@/features/applications/api/applications-api'
import {
  setShowSystemAppsPreference,
} from '@/features/configurations/utils/configuration-app-utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ConfirmDeleteDialog } from '@/shared/components/ConfirmDeleteDialog'
import { ListPagination } from '@/shared/components/ListPagination'
import { usePaginatedList } from '@/shared/hooks/use-paginated-list'
import { toast } from 'sonner'

const SHOW_SYSTEM_APPS_KEY = 'HMDM_showSystemApps'

function getApplicationsShowSystemAppsPreference(): boolean {
  if (typeof window === 'undefined') {
    return true
  }
  const stored = window.localStorage.getItem(SHOW_SYSTEM_APPS_KEY)
  if (stored == null) {
    return true
  }
  return stored === 'true'
}

const matchApplication = (application: Application, query: string): boolean =>
  application.name.toLowerCase().includes(query) ||
  (application.pkg ?? '').toLowerCase().includes(query)

function canManageApplication(application: Application): boolean {
  if (!application.commonApplication) {
    return true
  }
  return Boolean(application.customerId)
}

export function ApplicationsListPage() {
  const { t } = useTranslation()
  const { data, isLoading, error, refetch } = useApplicationsQuery()
  const deleteMutation = useDeleteApplicationMutation()

  const [searchInput, setSearchInput] = useState('')
  const [searchValue, setSearchValue] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Application | null>(null)
  const [assignTarget, setAssignTarget] = useState<Application | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [showSystemApps, setShowSystemApps] = useState(getApplicationsShowSystemAppsPreference)

  const filteredData = useMemo(() => {
    const apps = data ?? []
    if (showSystemApps) {
      return apps
    }
    return apps.filter((app) => !app.system)
  }, [data, showSystemApps])

  const matcher = useCallback(matchApplication, [])
  const { pageItems, pageNum, setPageNum, totalItems, totalPages, from, to } = usePaginatedList(
    filteredData,
    searchValue,
    matcher,
  )

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault()
    setSearchValue(searchInput)
  }

  const handleShowSystemAppsChange = (checked: boolean) => {
    setShowSystemApps(checked)
    setShowSystemAppsPreference(checked)
  }

  const handleDelete = async () => {
    if (!deleteTarget?.id) {
      return
    }

    try {
      await deleteMutation.mutateAsync(deleteTarget.id)
      toast.success(t('applications.delete.success'))
      setDeleteTarget(null)
    } catch {
      toast.error(
        deleteTarget.deletionProhibited
          ? t('applications.delete.inUse')
          : t('applications.delete.error')
      )
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('applications.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('applications.subtitle')}</p>
        </div>
        <Button type="button" onClick={() => setAddOpen(true)}>
          <Plus className="size-4" />
          {t('applications.add')}
        </Button>
      </div>

      <form onSubmit={handleSearch} className="flex max-w-xl gap-2">
        <Input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder={t('applications.searchPlaceholder')}
        />
        <Button type="submit" variant="secondary">
          {t('common.search')}
        </Button>
      </form>

      <label className="flex w-fit items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={showSystemApps}
          onChange={(e) => handleShowSystemAppsChange(e.target.checked)}
        />
        {t('configurations.editor.showSystemApps')}
      </label>

      {error != null && (
        <div className="rounded-lg border border-destructive/40 bg-card p-6 text-center">
          <p className="text-sm text-destructive">{t('common.loadError')}</p>
          <Button type="button" variant="outline" className="mt-3" onClick={() => void refetch()}>
            {t('common.retry')}
          </Button>
        </div>
      )}

      {isLoading && (
        <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
          {t('common.loading')}
        </div>
      )}

      {!isLoading && error == null && (
        <>
          {pageItems.length === 0 ? (
            <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
              {t('common.emptyList')}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border bg-card">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-b bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">{t('applications.columns.name')}</th>
                    <th className="px-4 py-3 font-medium">{t('applications.columns.pkg')}</th>
                    <th className="px-4 py-3 font-medium">{t('applications.columns.version')}</th>
                    <th className="px-4 py-3 font-medium">{t('applications.columns.type')}</th>
                    <th className="px-4 py-3 font-medium text-right">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((application) => {
                    const manageable = canManageApplication(application)

                    return (
                      <tr
                        key={application.id}
                        className="border-b last:border-b-0 hover:bg-muted/30"
                      >
                        <td className="px-4 py-3 font-medium">
                          {application.id != null ? (
                            <Link
                              to="/applications/$applicationId"
                              params={{ applicationId: String(application.id) }}
                              className="text-primary underline-offset-4 hover:underline"
                            >
                              {application.name}
                            </Link>
                          ) : (
                            application.name
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">{application.pkg ?? '—'}</td>
                        <td className="px-4 py-3">
                        {application.id != null ? (
                          <Link
                            to="/applications/$applicationId"
                            params={{ applicationId: String(application.id) }}
                            className="text-primary underline-offset-4 hover:underline"
                          >
                            {application.version ?? '—'}
                          </Link>
                        ) : (
                          application.version ?? '—'
                        )}
                      </td>
                        <td className="px-4 py-3">
                          {application.system ? (
                            <Badge variant="secondary">{t('applications.badges.system')}</Badge>
                          ) : application.commonApplication ? (
                            <Badge variant="secondary">{t('applications.badges.common')}</Badge>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {application.id != null && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-xs"
                                title={t('applications.configurations.action')}
                                onClick={() => setAssignTarget(application)}
                              >
                                <List className="size-3.5" />
                              </Button>
                            )}
                            {application.id != null && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-xs"
                                title={t('applications.versions.open')}
                                render={
                                  <Link
                                    to="/applications/$applicationId"
                                    params={{ applicationId: String(application.id) }}
                                  />
                                }
                              >
                                <Layers className="size-3.5" />
                              </Button>
                            )}
                            {manageable ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-xs"
                                title={
                                  application.deletionProhibited
                                    ? t('applications.delete.inUse')
                                    : t('common.delete')
                                }
                                className="text-destructive hover:text-destructive"
                                onClick={() => setDeleteTarget(application)}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            ) : (
                              <span
                                className="text-xs text-muted-foreground"
                                title={t('applications.delete.commonApp')}
                              >
                                —
                              </span>
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

          <ListPagination
            pageNum={pageNum}
            totalPages={totalPages}
            totalItems={totalItems}
            from={from}
            to={to}
            onPageChange={setPageNum}
          />
        </>
      )}

      <ApplicationFormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        closeOnSave
        onSavedApplication={() => {
          void refetch()
        }}
      />

      <ApplicationConfigurationsDialog
        open={assignTarget != null}
        onOpenChange={(open) => {
          if (!open) {
            setAssignTarget(null)
          }
        }}
        application={assignTarget}
      />

      <ConfirmDeleteDialog
        open={deleteTarget != null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null)
          }
        }}
        title={t('applications.delete.title')}
        description={
          deleteTarget?.deletionProhibited
            ? t('applications.delete.inUseConfirm', { name: deleteTarget?.name ?? '' })
            : t('applications.delete.confirm', { name: deleteTarget?.name ?? '' })
        }
        isPending={deleteMutation.isPending}
        onConfirm={() => void handleDelete()}
      />
    </div>
  )
}
