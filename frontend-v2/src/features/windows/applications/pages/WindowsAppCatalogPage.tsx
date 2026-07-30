import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { ApplicationEditSheet } from '@/features/windows/applications/components/ApplicationEditSheet'
import { SoftwareAppFormSheet } from '@/features/windows/applications/components/SoftwareAppFormSheet'
import {
  useDeleteSoftwareAppMutation,
  useSoftwareAppsQuery,
} from '@/features/windows/applications/hooks/use-windows-software-apps'
import type { SoftwareApp } from '@/features/windows/applications/types/software-app'
import { formatLatestVersionLabel, getLatestVersion } from '@/features/windows/applications/types/software-app'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ConfirmDeleteDialog } from '@/shared/components/ConfirmDeleteDialog'
import { ListPagination } from '@/shared/components/ListPagination'
import { usePaginatedList } from '@/shared/hooks/use-paginated-list'
import { usePermissions } from '@/features/auth/hooks/use-permissions'
import { toast } from 'sonner'

function matchApp(app: SoftwareApp, query: string): boolean {
  const latest = getLatestVersion(app)
  return (
    app.name.toLowerCase().includes(query) ||
    (app.latestVersion ?? '').toLowerCase().includes(query) ||
    (app.publisher ?? '').toLowerCase().includes(query) ||
    (latest?.downloadUrl ?? '').toLowerCase().includes(query) ||
    (latest?.wingetId ?? '').toLowerCase().includes(query)
  )
}

function formatTimestamp(value?: string): string {
  if (!value) {
    return '—'
  }
  const parsed = Date.parse(value)
  if (Number.isNaN(parsed)) {
    return '—'
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed)
}

export function WindowsAppCatalogPage() {
  const { t } = useTranslation()
  const { canMutate, canDeleteCritical } = usePermissions()
  const { data, isLoading, error, refetch } = useSoftwareAppsQuery()
  const deleteMutation = useDeleteSoftwareAppMutation()

  const [searchInput, setSearchInput] = useState('')
  const [searchValue, setSearchValue] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [editAppId, setEditAppId] = useState<number | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SoftwareApp | null>(null)

  const matcher = useCallback(matchApp, [])
  const { pageItems, pageNum, setPageNum, totalItems, totalPages, from, to } = usePaginatedList(
    data ?? [],
    searchValue,
    matcher,
  )

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault()
    setSearchValue(searchInput)
  }

  const handleDelete = async () => {
    if (!deleteTarget?.id) {
      return
    }

    try {
      await deleteMutation.mutateAsync(deleteTarget.id)
      toast.success(t('windowsAppCatalog.delete.success'))
      setDeleteTarget(null)
    } catch {
      toast.error(t('windowsAppCatalog.delete.error'))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('windowsAppCatalog.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('windowsAppCatalog.subtitle')}</p>
        </div>
        {canMutate && (
          <Button type="button" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            {t('windowsAppCatalog.createApp')}
          </Button>
        )}
      </div>

      <form onSubmit={handleSearch} className="flex max-w-xl gap-2">
        <Input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder={t('windowsAppCatalog.searchPlaceholder')}
        />
        <Button type="submit" variant="secondary">
          {t('common.search')}
        </Button>
      </form>

      {error != null && (
        <div className="rounded-lg border border-destructive/40 bg-card p-6 text-center">
          <p className="text-sm text-destructive">{t('common.loadError')}</p>
          <Button type="button" variant="outline" className="mt-3" onClick={() => void refetch()}>
            {t('common.retry')}
          </Button>
        </div>
      )}

      {isLoading && (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">{t('common.loading')}</CardContent>
        </Card>
      )}

      {!isLoading && error == null && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-muted/50">
                  <tr className="text-muted-foreground">
                    <th className="px-4 py-3 font-medium">{t('windowsAppCatalog.columns.name')}</th>
                    <th className="px-4 py-3 font-medium">{t('windowsAppCatalog.columns.version')}</th>
                    <th className="px-4 py-3 font-medium">{t('windowsAppCatalog.columns.versionsCount')}</th>
                    <th className="px-4 py-3 font-medium">{t('windowsAppCatalog.columns.updated')}</th>
                    {canMutate && (
                      <th className="px-4 py-3 font-medium">{t('windowsAppCatalog.columns.actions')}</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((app) => {
                    const latest = getLatestVersion(app)
                    return (
                      <tr
                        key={app.id}
                        className="cursor-pointer border-b last:border-0 hover:bg-muted/30"
                        onClick={() => setEditAppId(app.id)}
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium">{app.name}</div>
                          <div className="mt-0.5 text-xs text-muted-foreground">
                            {app.publisher || latest?.appType === 'winget'
                              ? app.publisher || latest?.wingetId || '—'
                              : '—'}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">{formatLatestVersionLabel(app)}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{app.versions.length}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {formatTimestamp(latest?.uploadedAt ?? app.createdAt)}
                        </td>
                        {canMutate && (
                          <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                            <div className="flex flex-wrap gap-2">
                              <Button type="button" size="sm" variant="outline" onClick={() => setEditAppId(app.id)}>
                                <Pencil className="mr-1.5 size-3.5" />
                                {t('common.edit')}
                              </Button>
                              {/* Removing the app discards its uploaded installers
                                  and breaks the configurations requiring it. */}
                              {canDeleteCritical && (
                                <Button type="button" size="sm" variant="outline" onClick={() => setDeleteTarget(app)}>
                                  <Trash2 className="mr-1.5 size-3.5" />
                                  {t('common.delete')}
                                </Button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                  {pageItems.length === 0 ? (
                    <tr>
                      <td
                        colSpan={canMutate ? 5 : 4}
                        className="px-4 py-10 text-center text-muted-foreground"
                      >
                        {t('windowsAppCatalog.empty')}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {!isLoading && totalItems > 0 ? (
        <ListPagination
          pageNum={pageNum}
          totalPages={totalPages}
          from={from}
          to={to}
          totalItems={totalItems}
          onPageChange={setPageNum}
        />
      ) : null}

      <SoftwareAppFormSheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(appId) => setEditAppId(appId)}
      />
      <ApplicationEditSheet open={editAppId != null} onOpenChange={(open) => !open && setEditAppId(null)} appId={editAppId} />

      <ConfirmDeleteDialog
        open={deleteTarget != null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null)
          }
        }}
        title={t('windowsAppCatalog.delete.title')}
        description={t('windowsAppCatalog.delete.description', { name: deleteTarget?.name ?? '' })}
        confirmLabel={t('common.delete')}
        confirmVariant="destructive"
        isPending={deleteMutation.isPending}
        onConfirm={() => void handleDelete()}
      />
    </div>
  )
}
