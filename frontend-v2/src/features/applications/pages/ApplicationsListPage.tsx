import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Trash2 } from 'lucide-react'
import {
  useApplicationsQuery,
  useDeleteApplicationMutation,
} from '@/features/applications/hooks/use-applications'
import type { Application } from '@/features/applications/api/applications-api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ConfirmDeleteDialog } from '@/shared/components/ConfirmDeleteDialog'
import { ListPagination } from '@/shared/components/ListPagination'
import { usePaginatedList } from '@/shared/hooks/use-paginated-list'
import { toast } from 'sonner'

const matchApplication = (application: Application, query: string): boolean =>
  application.name.toLowerCase().includes(query) ||
  (application.pkg ?? '').toLowerCase().includes(query)

export function ApplicationsListPage() {
  const { t } = useTranslation()
  const { data, isLoading, error, refetch } = useApplicationsQuery()
  const deleteMutation = useDeleteApplicationMutation()

  const [searchInput, setSearchInput] = useState('')
  const [searchValue, setSearchValue] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Application | null>(null)

  const matcher = useCallback(matchApplication, [])
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
      toast.success(t('applications.delete.success'))
      setDeleteTarget(null)
    } catch {
      toast.error(t('applications.delete.error'))
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('applications.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('applications.subtitle')}</p>
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
                  {pageItems.map((application) => (
                    <tr
                      key={application.id}
                      className="border-b last:border-b-0 hover:bg-muted/30"
                    >
                      <td className="px-4 py-3 font-medium">{application.name}</td>
                      <td className="px-4 py-3 font-mono text-xs">{application.pkg ?? '—'}</td>
                      <td className="px-4 py-3">{application.version ?? '—'}</td>
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
                        <div className="flex items-center justify-end">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            title={t('common.delete')}
                            className="text-destructive hover:text-destructive"
                            disabled={application.deletionProhibited === true}
                            onClick={() => setDeleteTarget(application)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
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

      <ConfirmDeleteDialog
        open={deleteTarget != null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null)
          }
        }}
        title={t('applications.delete.title')}
        description={t('applications.delete.confirm', { name: deleteTarget?.name ?? '' })}
        isPending={deleteMutation.isPending}
        onConfirm={() => void handleDelete()}
      />
    </div>
  )
}
