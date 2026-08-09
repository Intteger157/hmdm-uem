import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, Pencil, Plus, Trash2, UsersRound } from 'lucide-react'
import { WindowsGroupFormDialog } from '@/features/windows/groups/components/WindowsGroupFormDialog'
import {
  useDeleteWindowsGroupMutation,
  useWindowsGroupsQuery,
} from '@/features/windows/groups/hooks/use-windows-groups'
import type { WindowsGroup } from '@/features/windows/groups/types/windows-group'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ConfirmDeleteDialog } from '@/shared/components/ConfirmDeleteDialog'
import { ListPagination } from '@/shared/components/ListPagination'
import { usePermissions } from '@/features/auth/hooks/use-permissions'
import {
  DATA_TABLE_CLASS,
  DATA_TABLE_COL_COMPACT,
  DATA_TABLE_COL_MEDIUM,
  PageContainer,
  PageHeader,
  PageToolbar,
} from '@/shared/layout/page-layout'
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
        <form onSubmit={handleSearch} className="flex max-w-xl flex-1 gap-2">
          <Input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder={t('windowsGroups.searchPlaceholder')}
            className="border-white/10 bg-black/20"
          />
          <Button type="submit" variant="secondary">
            {t('common.search')}
          </Button>
        </form>
      </PageToolbar>

      {error != null && (
        <Card className="border-destructive/40 bg-[#111]">
          <CardContent className="space-y-3 py-8 text-center">
            <p className="text-sm text-destructive">{t('windowsGroups.loadError')}</p>
            <Button type="button" variant="outline" onClick={() => void refetch()}>
              {t('common.retry')}
            </Button>
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <Card className="border-white/10 bg-[#111]">
          <CardContent className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {t('common.loading')}
          </CardContent>
        </Card>
      )}

      {!isLoading && error == null && (
        <>
          {pageItems.length === 0 ? (
            <Card className="border-white/10 bg-[#111]">
              <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
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
              </CardContent>
            </Card>
          ) : (
            <Card className="overflow-hidden border-white/10 bg-[#111]">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className={DATA_TABLE_CLASS}>
                    <thead>
                      <tr className="border-b border-white/10 bg-white/[0.03] text-left text-sm text-muted-foreground">
                        <th className="px-4 py-3 font-medium">{t('windowsGroups.columns.name')}</th>
                        <th className={`px-4 py-3 font-medium ${DATA_TABLE_COL_MEDIUM}`}>
                          {t('windowsGroups.columns.description')}
                        </th>
                        <th className={`px-4 py-3 font-medium ${DATA_TABLE_COL_COMPACT}`}>
                          {t('windowsGroups.columns.devices')}
                        </th>
                        <th className={`px-4 py-3 font-medium ${DATA_TABLE_COL_MEDIUM}`}>
                          {t('windowsGroups.columns.configuration')}
                        </th>
                        {canMutate && (
                          <th className={`px-4 py-3 font-medium text-right ${DATA_TABLE_COL_COMPACT}`}>
                            {t('common.actions')}
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {pageItems.map((group) => (
                        <tr
                          key={group.id}
                          className="border-b border-white/5 last:border-b-0 transition-colors hover:bg-white/[0.03]"
                        >
                          <td className="px-4 py-3 font-medium text-foreground">{group.name}</td>
                          <td className={`px-4 py-3 text-sm text-muted-foreground ${DATA_TABLE_COL_MEDIUM}`}>
                            {group.description?.trim() || '—'}
                          </td>
                          <td className={`px-4 py-3 tabular-nums ${DATA_TABLE_COL_COMPACT}`}>
                            {group.deviceCount}
                          </td>
                          <td className={`px-4 py-3 text-sm ${DATA_TABLE_COL_MEDIUM}`}>
                            {group.configurationName?.trim() || t('windowsGroups.noConfiguration')}
                          </td>
                          {canMutate && (
                            <td className={`px-4 py-3 text-right ${DATA_TABLE_COL_COMPACT}`}>
                              <div className="flex items-center justify-end gap-0.5">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={t('common.edit')}
                                  className="text-muted-foreground hover:bg-white/10 hover:text-foreground"
                                  onClick={() => openEdit(group)}
                                >
                                  <Pencil className="size-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={t('common.delete')}
                                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                  onClick={() => setDeleteTarget(group)}
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
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
