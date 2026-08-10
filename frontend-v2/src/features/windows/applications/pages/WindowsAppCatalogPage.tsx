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
import {
  WINDOWS_GRID_APPS,
  WindowsDataList,
  WindowsDataListBody,
  WindowsDataListCell,
  WindowsDataListEmpty,
  WindowsDataListHeader,
  WindowsDataListPanel,
  WindowsDataListRow,
} from '@/features/windows/components/WindowsDataList'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ConfirmDeleteDialog } from '@/shared/components/ConfirmDeleteDialog'
import { ListPagination } from '@/shared/components/ListPagination'
import { usePaginatedList } from '@/shared/hooks/use-paginated-list'
import { usePermissions } from '@/features/auth/hooks/use-permissions'
import { PageContainer, PageHeader, PageToolbar } from '@/shared/layout/page-layout'
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
    <PageContainer size="wide">
      <PageHeader title={t('windowsAppCatalog.title')} description={t('windowsAppCatalog.subtitle')}>
        {canMutate && (
          <Button type="button" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            {t('windowsAppCatalog.createApp')}
          </Button>
        )}
      </PageHeader>

      <PageToolbar>
        <form onSubmit={handleSearch} className="flex w-full max-w-xl flex-1 gap-2">
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t('windowsAppCatalog.searchPlaceholder')}
          />
          <Button type="submit" variant="secondary">
            {t('common.search')}
          </Button>
        </form>
      </PageToolbar>

      {error != null && (
        <div className="rounded-lg border border-destructive/40 bg-card p-6 text-center">
          <p className="text-sm text-destructive">{t('common.loadError')}</p>
          <Button type="button" variant="outline" className="mt-3" onClick={() => void refetch()}>
            {t('common.retry')}
          </Button>
        </div>
      )}

      {isLoading && (
        <WindowsDataListPanel className="p-6 text-sm text-muted-foreground">{t('common.loading')}</WindowsDataListPanel>
      )}

      {!isLoading && error == null && (
        <WindowsDataList aria-label={t('windowsAppCatalog.title')}>
          <WindowsDataListHeader gridClass={WINDOWS_GRID_APPS}>
                <WindowsDataListCell role="columnheader">{t('windowsAppCatalog.columns.name')}</WindowsDataListCell>
                <WindowsDataListCell role="columnheader">{t('windowsAppCatalog.columns.version')}</WindowsDataListCell>
                <WindowsDataListCell role="columnheader">
                  {t('windowsAppCatalog.columns.versionsCount')}
                </WindowsDataListCell>
                <WindowsDataListCell role="columnheader">{t('windowsAppCatalog.columns.updated')}</WindowsDataListCell>
                {canMutate ? (
                  <WindowsDataListCell role="columnheader" className="text-right">
                    {t('windowsAppCatalog.columns.actions')}
                  </WindowsDataListCell>
                ) : null}
              </WindowsDataListHeader>

              <WindowsDataListBody>
                {pageItems.length === 0 ? (
                  <WindowsDataListEmpty>{t('windowsAppCatalog.empty')}</WindowsDataListEmpty>
                ) : (
                  pageItems.map((app) => {
                    const latest = getLatestVersion(app)
                    return (
                      <WindowsDataListRow
                        key={app.id}
                        gridClass={WINDOWS_GRID_APPS}
                        onClick={() => setEditAppId(app.id)}
                      >
                        <WindowsDataListCell>
                          <div className="truncate font-medium">{app.name}</div>
                          <div className="mt-0.5 truncate text-xs text-muted-foreground">
                            {app.publisher || latest?.appType === 'winget'
                              ? app.publisher || latest?.wingetId || '—'
                              : '—'}
                          </div>
                        </WindowsDataListCell>
                        <WindowsDataListCell className="tabular-nums text-muted-foreground">
                          {formatLatestVersionLabel(app)}
                        </WindowsDataListCell>
                        <WindowsDataListCell className="tabular-nums">{app.versions.length}</WindowsDataListCell>
                        <WindowsDataListCell className="whitespace-nowrap text-muted-foreground">
                          {formatTimestamp(latest?.uploadedAt ?? app.createdAt)}
                        </WindowsDataListCell>
                        {canMutate ? (
                          <WindowsDataListCell
                            className="flex justify-end"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <div className="flex flex-wrap justify-end gap-2">
                              <Button type="button" size="sm" variant="outline" onClick={() => setEditAppId(app.id)}>
                                <Pencil className="mr-1.5 size-3.5" />
                                {t('common.edit')}
                              </Button>
                              {canDeleteCritical && (
                                <Button type="button" size="sm" variant="outline" onClick={() => setDeleteTarget(app)}>
                                  <Trash2 className="mr-1.5 size-3.5" />
                                  {t('common.delete')}
                                </Button>
                              )}
                            </div>
                          </WindowsDataListCell>
                        ) : null}
                      </WindowsDataListRow>
                    )
                  })
                )}
              </WindowsDataListBody>
        </WindowsDataList>
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
    </PageContainer>
  )
}
