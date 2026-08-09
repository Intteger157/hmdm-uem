import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { UserFormDialog } from '@/features/users/components/UserFormDialog'
import { useDeleteUserMutation, useUsersQuery } from '@/features/users/hooks/use-users'
import type { UserAccount } from '@/features/users/api/users-api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ConfirmDeleteDialog } from '@/shared/components/ConfirmDeleteDialog'
import { DataTable } from '@/shared/components/DataTable'
import { ListPagination } from '@/shared/components/ListPagination'
import { DATA_TABLE_COL_COMPACT, PageContainer, PageHeader, PageToolbar } from '@/shared/layout/page-layout'
import { usePaginatedList } from '@/shared/hooks/use-paginated-list'
import { toast } from 'sonner'

const matchUser = (user: UserAccount, query: string): boolean =>
  user.login.toLowerCase().includes(query) ||
  (user.name ?? '').toLowerCase().includes(query) ||
  (user.email ?? '').toLowerCase().includes(query)

export function UsersListPage() {
  const { t } = useTranslation()
  const { data, isLoading, error, refetch } = useUsersQuery()
  const deleteMutation = useDeleteUserMutation()

  const [searchInput, setSearchInput] = useState('')
  const [searchValue, setSearchValue] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<UserAccount | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<UserAccount | null>(null)

  const matcher = useCallback(matchUser, [])
  const { pageItems, pageNum, setPageNum, totalItems, totalPages, from, to } = usePaginatedList(
    data ?? [],
    searchValue,
    matcher,
  )

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault()
    setSearchValue(searchInput)
  }

  const openAdd = () => {
    setEditTarget(null)
    setFormOpen(true)
  }

  const openEdit = (user: UserAccount) => {
    setEditTarget(user)
    setFormOpen(true)
  }

  const handleDelete = async () => {
    if (!deleteTarget?.id) {
      return
    }

    try {
      await deleteMutation.mutateAsync(deleteTarget.id)
      toast.success(t('users.delete.success'))
      setDeleteTarget(null)
    } catch {
      toast.error(t('users.delete.error'))
    }
  }

  return (
    <PageContainer size="wide">
      <PageHeader title={t('users.title')} description={t('users.subtitle')} />

      <PageToolbar>
        <form onSubmit={handleSearch} className="flex max-w-xl flex-1 gap-2">
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t('users.searchPlaceholder')}
          />
          <Button type="submit" variant="secondary">
            {t('common.search')}
          </Button>
        </form>
        <Button type="button" onClick={openAdd}>
          <Plus className="size-4" />
          {t('users.add')}
        </Button>
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
            <DataTable tableClassName="min-w-[640px]">
                <thead className="border-b bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">{t('users.columns.login')}</th>
                    <th className="px-4 py-3 font-medium">{t('users.columns.name')}</th>
                    <th className="px-4 py-3 font-medium">{t('users.columns.email')}</th>
                    <th className={`px-4 py-3 font-medium ${DATA_TABLE_COL_COMPACT}`}>
                      {t('users.columns.role')}
                    </th>
                    <th className={`px-4 py-3 font-medium text-right ${DATA_TABLE_COL_COMPACT}`}>
                      {t('common.actions')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((user) => (
                    <tr key={user.id} className="border-b last:border-b-0 hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">{user.login}</td>
                      <td className="px-4 py-3">{user.name || '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{user.email || '—'}</td>
                      <td className={`px-4 py-3 ${DATA_TABLE_COL_COMPACT}`}>
                        {user.userRole?.name ? (
                          <Badge variant="secondary">{user.userRole.name}</Badge>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className={`px-4 py-3 ${DATA_TABLE_COL_COMPACT}`}>
                        <div className="flex items-center justify-end gap-0.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            title={t('common.edit')}
                            onClick={() => openEdit(user)}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            title={t('common.delete')}
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget(user)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
            </DataTable>
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

      <UserFormDialog open={formOpen} onOpenChange={setFormOpen} user={editTarget} />

      <ConfirmDeleteDialog
        open={deleteTarget != null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null)
          }
        }}
        title={t('users.delete.title')}
        description={t('users.delete.confirm', { login: deleteTarget?.login ?? '' })}
        isPending={deleteMutation.isPending}
        onConfirm={() => void handleDelete()}
      />
    </PageContainer>
  )
}
