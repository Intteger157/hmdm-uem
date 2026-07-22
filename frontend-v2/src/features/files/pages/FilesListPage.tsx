import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Trash2 } from 'lucide-react'
import { formatFileSize } from '@/features/files/api/files-api'
import { useDeleteFileMutation, useFilesQuery } from '@/features/files/hooks/use-files'
import type { FileEntry } from '@/features/files/api/files-api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ConfirmDeleteDialog } from '@/shared/components/ConfirmDeleteDialog'
import { ListPagination } from '@/shared/components/ListPagination'
import { usePaginatedList } from '@/shared/hooks/use-paginated-list'
import { toast } from 'sonner'

const matchFile = (file: FileEntry, query: string): boolean =>
  (file.filePath ?? '').toLowerCase().includes(query) ||
  (file.description ?? '').toLowerCase().includes(query) ||
  (file.url ?? '').toLowerCase().includes(query)

function formatUploadTime(ms?: number): string {
  if (!ms) {
    return '—'
  }
  return new Date(ms).toLocaleString()
}

export function FilesListPage() {
  const { t } = useTranslation()
  const { data, isLoading, error, refetch } = useFilesQuery()
  const deleteMutation = useDeleteFileMutation()

  const [searchInput, setSearchInput] = useState('')
  const [searchValue, setSearchValue] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<FileEntry | null>(null)

  const matcher = useCallback(matchFile, [])
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
    if (!deleteTarget) {
      return
    }

    try {
      await deleteMutation.mutateAsync(deleteTarget)
      toast.success(t('files.delete.success'))
      setDeleteTarget(null)
    } catch {
      toast.error(t('files.delete.error'))
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('files.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('files.subtitle')}</p>
      </div>

      <form onSubmit={handleSearch} className="flex max-w-xl gap-2">
        <Input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder={t('files.searchPlaceholder')}
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
              <table className="w-full min-w-[800px] text-left text-sm">
                <thead className="border-b bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">{t('files.columns.path')}</th>
                    <th className="px-4 py-3 font-medium">{t('files.columns.description')}</th>
                    <th className="px-4 py-3 font-medium">{t('files.columns.size')}</th>
                    <th className="px-4 py-3 font-medium">{t('files.columns.uploaded')}</th>
                    <th className="px-4 py-3 font-medium">{t('files.columns.type')}</th>
                    <th className="px-4 py-3 font-medium text-right">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((file) => {
                    const inUse =
                      (file.usedByConfigurations?.length ?? 0) > 0 ||
                      (file.usedByIcons?.length ?? 0) > 0

                    return (
                      <tr key={file.id ?? file.filePath ?? file.url} className="border-b last:border-b-0 hover:bg-muted/30">
                        <td className="px-4 py-3 font-mono text-xs">{file.filePath ?? file.url ?? '—'}</td>
                        <td className="px-4 py-3">{file.description ?? '—'}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{formatFileSize(file.size)}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                          {formatUploadTime(file.uploadTime)}
                        </td>
                        <td className="px-4 py-3">
                          {file.external ? (
                            <Badge variant="secondary">{t('files.badges.external')}</Badge>
                          ) : (
                            <Badge variant="secondary">{t('files.badges.local')}</Badge>
                          )}
                          {inUse && (
                            <Badge variant="secondary" className="ml-1">
                              {t('files.badges.inUse')}
                            </Badge>
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
                              disabled={inUse}
                              onClick={() => setDeleteTarget(file)}
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
        title={t('files.delete.title')}
        description={t('files.delete.confirm', {
          name: deleteTarget?.filePath ?? deleteTarget?.description ?? '',
        })}
        isPending={deleteMutation.isPending}
        onConfirm={() => void handleDelete()}
      />
    </div>
  )
}
