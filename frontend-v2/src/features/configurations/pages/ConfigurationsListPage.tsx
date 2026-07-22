import { useCallback, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { Copy, Pencil, Plus, Trash2 } from 'lucide-react'
import { ConfigurationCopyDialog } from '@/features/configurations/components/ConfigurationCopyDialog'
import {
  useConfigurationsQuery,
  useDeleteConfigurationMutation,
} from '@/features/configurations/hooks/use-configurations'
import type { Configuration } from '@/features/configurations/api/configurations-api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ConfirmDeleteDialog } from '@/shared/components/ConfirmDeleteDialog'
import { ListPagination } from '@/shared/components/ListPagination'
import { usePaginatedList } from '@/shared/hooks/use-paginated-list'
import { toast } from 'sonner'

const matchConfiguration = (configuration: Configuration, query: string): boolean =>
  configuration.name.toLowerCase().includes(query) ||
  (configuration.description ?? '').toLowerCase().includes(query)

export function ConfigurationsListPage() {
  const { t } = useTranslation()
  const { data, isLoading, error, refetch } = useConfigurationsQuery()
  const deleteMutation = useDeleteConfigurationMutation()

  const [searchInput, setSearchInput] = useState('')
  const [searchValue, setSearchValue] = useState('')
  const [copyTarget, setCopyTarget] = useState<Configuration | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Configuration | null>(null)

  const matcher = useCallback(matchConfiguration, [])
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
      toast.success(t('configurations.delete.success'))
      setDeleteTarget(null)
    } catch {
      toast.error(t('configurations.delete.error'))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('configurations.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('configurations.subtitle')}</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <form onSubmit={handleSearch} className="flex max-w-xl flex-1 gap-2">
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t('configurations.searchPlaceholder')}
          />
          <Button type="submit" variant="secondary">
            {t('common.search')}
          </Button>
        </form>
        <Button type="button" render={<Link to="/configurations/new" />}>
          <Plus className="size-4" />
          {t('configurations.add')}
        </Button>
      </div>

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
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">{t('configurations.columns.name')}</th>
                    <th className="px-4 py-3 font-medium">
                      {t('configurations.columns.description')}
                    </th>
                    <th className="px-4 py-3 font-medium">
                      {t('configurations.columns.qrCodeKey')}
                    </th>
                    <th className="px-4 py-3 font-medium text-right">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((configuration) => (
                    <tr key={configuration.id} className="border-b last:border-b-0 hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <Link
                          to="/configurations/$configId"
                          params={{ configId: String(configuration.id) }}
                          className="font-medium text-primary hover:underline"
                        >
                          {configuration.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {configuration.description || '—'}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {configuration.qrCodeKey ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-0.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            title={t('common.edit')}
                            render={
                              <Link
                                to="/configurations/$configId"
                                params={{ configId: String(configuration.id) }}
                              />
                            }
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            title={t('configurations.copy.action')}
                            onClick={() => setCopyTarget(configuration)}
                          >
                            <Copy className="size-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            title={t('common.delete')}
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget(configuration)}
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

      <ConfigurationCopyDialog
        open={copyTarget != null}
        onOpenChange={(open) => {
          if (!open) {
            setCopyTarget(null)
          }
        }}
        configuration={copyTarget}
      />

      <ConfirmDeleteDialog
        open={deleteTarget != null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null)
          }
        }}
        title={t('configurations.delete.title')}
        description={t('configurations.delete.confirm', { name: deleteTarget?.name ?? '' })}
        isPending={deleteMutation.isPending}
        onConfirm={() => void handleDelete()}
      />
    </div>
  )
}
