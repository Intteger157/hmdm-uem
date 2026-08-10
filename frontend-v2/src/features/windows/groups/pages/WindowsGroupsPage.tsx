import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, Pencil, Plus, Trash2, UsersRound } from 'lucide-react'
import { WindowsGroupFormDialog } from '@/features/windows/groups/components/WindowsGroupFormDialog'
import {
  useDeleteWindowsGroupMutation,
  useWindowsGroupsQuery,
} from '@/features/windows/groups/hooks/use-windows-groups'
import type { WindowsGroup } from '@/features/windows/groups/types/windows-group'
import {
  WINDOWS_GRID_GROUPS,
  WindowsDataList,
  WindowsDataListBody,
  WindowsDataListCell,
  WindowsDataListHeader,
  WindowsDataListPanel,
  WindowsDataListRow,
} from '@/features/windows/components/WindowsDataList'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ConfirmDeleteDialog } from '@/shared/components/ConfirmDeleteDialog'
import { ListPagination } from '@/shared/components/ListPagination'
import { usePermissions } from '@/features/auth/hooks/use-permissions'
import { PageContainer, PageHeader, PageToolbar } from '@/shared/layout/page-layout'
import { usePaginatedList } from '@/shared/hooks/use-paginated-list'
import { toast } from 'sonner'

function matchGroup(group: WindowsGroup, query: string): boolean {
  return (
    group.name.toLowerCase().includes(query) ||
    (group.description ?? '').toLowerCase().includes(query) ||
    (group.configurationName ?? '').toLowerCase().includes(query)
  )
}

export function WindowsGroupsPage() {
  const { t } = useTranslation()
  const { canMutate } = usePermissions()
  const { data, isLoading, error, refetch } = useWindowsGroupsQuery()
  const deleteMutation = useDeleteWindowsGroupMutation()

  const [searchInput, setSearchInput] = useState('')
  const [searchValue, setSearchValue] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<WindowsGroup | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<WindowsGroup | null>(null)

  const matcher = useCallback(matchGroup, [])
  const { pageItems, pageNum, setPageNum, totalItems, totalPages, from, to } = usePaginatedList(
    data ?? [],
    searchValue,
    matcher,
  )

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault()
    setSearchValue(searchInput)
  }

  const openCreate = () => {
    setEditTarget(null)
    setFormOpen(true)
  }

  const openEdit = (group: WindowsGroup) => {
    setEditTarget(group)
    setFormOpen(true)
  }

  const handleDelete = async () => {
    if (!deleteTarget?.id) {
      return
    }

    try {
      await deleteMutation.mutateAsync(deleteTarget.id)
      toast.success(t('windowsGroups.delete.success'))
      setDeleteTarget(null)
    } catch {
      toast.error(t('windowsGroups.delete.error'))
    }
  }

  return (
    <PageContainer size="wide">
      <PageHeader title={t('windowsGroups.title')} description={t('windowsGroups.subtitle')}>
        {canMutate && (
          <Button type="button" onClick={openCreate}>
            <Plus className="size-4" />
            {t('windowsGroups.create')}
          </Button>
        )}
      </PageHeader>

      <PageToolbar>
        <form onSubmit={handleSearch} className="flex w-full max-w-xl flex-1 gap-2">
          <Input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder={t('windowsGroups.searchPlaceholder')}
          />
          <Button type="submit" variant="secondary">
            {t('common.search')}
          </Button>
        </form>
      </PageToolbar>

      {error != null && (
        <WindowsDataListPanel className="space-y-3 py-8 text-center">
          <p className="text-sm text-destructive">{t('windowsGroups.loadError')}</p>
          <Button type="button" variant="outline" onClick={() => void refetch()}>
            {t('common.retry')}
          </Button>
        </WindowsDataListPanel>
      )}

      {isLoading && (
        <WindowsDataListPanel className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {t('common.loading')}
        </WindowsDataListPanel>
      )}

      {!isLoading && error == null && (
        <>
          {pageItems.length === 0 ? (
            <WindowsDataListPanel className="flex flex-col items-center gap-3 py-16 text-center">
              <UsersRound className="size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {searchValue.trim() ? t('windowsGroups.emptySearch') : t('windowsGroups.empty')}
              </p>
              {canMutate && !searchValue.trim() ? (
                <Button type="button" variant="outline" onClick={openCreate}>
                  <Plus className="size-4" />
                  {t('windowsGroups.create')}
                </Button>
              ) : null}
            </WindowsDataListPanel>
          ) : (
            <WindowsDataList aria-label={t('windowsGroups.title')}>
                  <WindowsDataListHeader gridClass={WINDOWS_GRID_GROUPS}>
                    <WindowsDataListCell role="columnheader">{t('windowsGroups.columns.name')}</WindowsDataListCell>
                    <WindowsDataListCell role="columnheader">{t('windowsGroups.columns.description')}</WindowsDataListCell>
                    <WindowsDataListCell role="columnheader">{t('windowsGroups.columns.devices')}</WindowsDataListCell>
                    <WindowsDataListCell role="columnheader">
                      {t('windowsGroups.columns.configuration')}
                    </WindowsDataListCell>
                    {canMutate ? (
                      <WindowsDataListCell role="columnheader" className="text-right">
                        {t('common.actions')}
                      </WindowsDataListCell>
                    ) : null}
                  </WindowsDataListHeader>

                  <WindowsDataListBody>
                    {pageItems.map((group) => (
                      <WindowsDataListRow key={group.id} gridClass={WINDOWS_GRID_GROUPS}>
                        <WindowsDataListCell>
                          <div className="truncate font-medium text-foreground">{group.name}</div>
                        </WindowsDataListCell>
                        <WindowsDataListCell className="text-muted-foreground">
                          <div className="line-clamp-2">{group.description?.trim() || '—'}</div>
                        </WindowsDataListCell>
                        <WindowsDataListCell className="tabular-nums">{group.deviceCount}</WindowsDataListCell>
                        <WindowsDataListCell className="truncate text-muted-foreground">
                          {group.configurationName?.trim() || t('windowsGroups.noConfiguration')}
                        </WindowsDataListCell>
                        {canMutate ? (
                          <WindowsDataListCell className="flex justify-end">
                            <div className="flex items-center justify-end gap-0.5">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                aria-label={t('common.edit')}
                                className="text-muted-foreground hover:text-foreground"
                                onClick={() => openEdit(group)}
                              >
                                <Pencil className="size-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                aria-label={t('common.delete')}
                                className="text-destructive hover:text-destructive"
                                onClick={() => setDeleteTarget(group)}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </div>
                          </WindowsDataListCell>
                        ) : null}
                      </WindowsDataListRow>
                    ))}
                  </WindowsDataListBody>
            </WindowsDataList>
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

      <WindowsGroupFormDialog open={formOpen} onOpenChange={setFormOpen} group={editTarget} />

      <ConfirmDeleteDialog
        open={deleteTarget != null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null)
          }
        }}
        title={t('windowsGroups.delete.title')}
        description={t('windowsGroups.delete.confirm', { name: deleteTarget?.name ?? '' })}
        isPending={deleteMutation.isPending}
        onConfirm={() => void handleDelete()}
      />
    </PageContainer>
  )
}
