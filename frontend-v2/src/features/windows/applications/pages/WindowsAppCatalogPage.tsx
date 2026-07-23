import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { SoftwareAppFormSheet } from '@/features/windows/applications/components/SoftwareAppFormSheet'
import {
  useDeleteSoftwareAppMutation,
  useSoftwareAppsQuery,
} from '@/features/windows/applications/hooks/use-windows-software-apps'
import type { SoftwareApp } from '@/features/windows/applications/types/software-app'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ConfirmDeleteDialog } from '@/shared/components/ConfirmDeleteDialog'
import { ListPagination } from '@/shared/components/ListPagination'
import { usePaginatedList } from '@/shared/hooks/use-paginated-list'
import { toast } from 'sonner'

function matchApp(app: SoftwareApp, query: string): boolean {
  return (
    app.name.toLowerCase().includes(query) ||
    (app.version ?? '').toLowerCase().includes(query) ||
    (app.downloadUrl ?? '').toLowerCase().includes(query) ||
    (app.wingetId ?? '').toLowerCase().includes(query)
  )
}

function formatTimestamp(value: string): string {
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
  const { data, isLoading, error, refetch } = useSoftwareAppsQuery()
  const deleteMutation = useDeleteSoftwareAppMutation()

  const [searchInput, setSearchInput] = useState('')
  const [searchValue, setSearchValue] = useState('')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<SoftwareApp | null>(null)
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
        <Button
          type="button"
          onClick={() => {
            setEditTarget(null)
            setSheetOpen(true)
          }}
        >
          <Plus className="size-4" />
          {t('windowsAppCatalog.createApp')}
        </Button>
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
                    <th className="px-4 py-3 font-medium">{t('windowsAppCatalog.columns.installArgs')}</th>
                    <th className="px-4 py-3 font-medium">{t('windowsAppCatalog.columns.updated')}</th>
                    <th className="px-4 py-3 font-medium">{t('windowsAppCatalog.columns.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((app) => (
                    <tr key={app.id} className="border-b last:border-0">
                      <td className="px-4 py-3">
                        <div className="font-medium">{app.name}</div>
                        <div className="mt-0.5 max-w-md truncate text-xs text-muted-foreground">
                          {app.appType === 'winget'
                            ? app.wingetId || '—'
                            : app.downloadUrl || '—'}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{app.version || '—'}</td>
                      <td className="px-4 py-3 font-mono text-xs">{app.installArgs || '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{formatTimestamp(app.updatedAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditTarget(app)
                              setSheetOpen(true)
                            }}
                          >
                            <Pencil className="mr-1.5 size-3.5" />
                            {t('common.edit')}
                          </Button>
                          <Button type="button" size="sm" variant="outline" onClick={() => setDeleteTarget(app)}>
                            <Trash2 className="mr-1.5 size-3.5" />
                            {t('common.delete')}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {pageItems.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
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

      <SoftwareAppFormSheet open={sheetOpen} onOpenChange={setSheetOpen} app={editTarget} />

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
