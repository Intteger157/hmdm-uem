import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2 } from 'lucide-react'
import { MessagingSendDialog } from '@/features/plugins/messaging/components/MessagingSendDialog'
import {
  useDeleteMessagingMutation,
  useMessagingMessagesQuery,
} from '@/features/plugins/messaging/hooks/use-messaging'
import type { MessagingMessage } from '@/features/plugins/messaging/api/messaging-api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ConfirmDeleteDialog } from '@/shared/components/ConfirmDeleteDialog'
import { DataTable } from '@/shared/components/DataTable'
import { ListPagination } from '@/shared/components/ListPagination'
import { DATA_TABLE_COL_COMPACT, PageContainer, PageHeader } from '@/shared/layout/page-layout'
import { toast } from 'sonner'

function formatTime(ms?: number): string {
  if (!ms) return '—'
  return new Date(ms).toLocaleString()
}

export function MessagingListPage() {
  const { t } = useTranslation()
  const [pageNum, setPageNum] = useState(1)
  const [deviceFilter, setDeviceFilter] = useState('')
  const [searchDevice, setSearchDevice] = useState('')
  const [sendOpen, setSendOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<MessagingMessage | null>(null)

  const { data, isLoading, error, refetch } = useMessagingMessagesQuery({
    pageNum,
    pageSize: 50,
    deviceFilter: searchDevice,
    sortValue: 'createTime',
  })
  const deleteMutation = useDeleteMessagingMutation()

  const messages = data?.items ?? []
  const totalItems = data?.totalItemsCount ?? 0
  const totalPages = Math.max(1, Math.ceil(totalItems / 50))
  const from = totalItems === 0 ? 0 : (pageNum - 1) * 50 + 1
  const to = Math.min(pageNum * 50, totalItems)

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault()
    setPageNum(1)
    setSearchDevice(deviceFilter.trim())
  }

  const handleDelete = async () => {
    if (!deleteTarget?.id) return
    try {
      await deleteMutation.mutateAsync(deleteTarget.id)
      toast.success(t('plugins.messaging.delete.success'))
      setDeleteTarget(null)
    } catch {
      toast.error(t('plugins.messaging.delete.error'))
    }
  }

  return (
    <PageContainer size="wide">
      <PageHeader title={t('plugins.messaging.title')} description={t('plugins.messaging.subtitle')}>
        <Button type="button" onClick={() => setSendOpen(true)}>
          <Plus className="mr-1 size-4" />
          {t('plugins.messaging.send')}
        </Button>
      </PageHeader>

      <form onSubmit={handleSearch} className="flex flex-wrap gap-2">
        <Input
          value={deviceFilter}
          onChange={(e) => setDeviceFilter(e.target.value)}
          placeholder={t('plugins.messaging.filterDevice')}
          className="max-w-xs"
        />
        <Button type="submit" variant="outline">{t('common.search')}</Button>
      </form>

      {isLoading && <p className="text-sm text-muted-foreground">{t('common.loading')}</p>}
      {error != null && (
        <div className="rounded-lg border border-destructive/40 p-4">
          <p className="text-sm text-destructive">{t('common.loadError')}</p>
          <Button type="button" variant="outline" className="mt-2" onClick={() => void refetch()}>
            {t('common.retry')}
          </Button>
        </div>
      )}

      {!isLoading && error == null && (
        <>
          <DataTable>
            <thead className="border-b bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">{t('plugins.messaging.columns.device')}</th>
                <th className="px-4 py-3 font-medium">{t('plugins.messaging.columns.message')}</th>
                <th className={`px-4 py-3 font-medium ${DATA_TABLE_COL_COMPACT}`}>
                  {t('plugins.messaging.columns.time')}
                </th>
                <th className={`px-4 py-3 font-medium text-right ${DATA_TABLE_COL_COMPACT}`}>
                  {t('common.actions')}
                </th>
              </tr>
            </thead>
            <tbody>
              {messages.map((msg) => (
                <tr key={msg.id ?? `${msg.deviceNumber}-${msg.createTime}`} className="border-b last:border-b-0">
                  <td className="px-4 py-3 font-mono text-xs">{msg.deviceNumber ?? '—'}</td>
                  <td className="max-w-md truncate px-4 py-3">{msg.message ?? '—'}</td>
                  <td className={`px-4 py-3 ${DATA_TABLE_COL_COMPACT}`}>{formatTime(msg.createTime)}</td>
                  <td className={`px-4 py-3 ${DATA_TABLE_COL_COMPACT}`}>
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          className="text-destructive"
                          disabled={!msg.id}
                          onClick={() => setDeleteTarget(msg)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {messages.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                      {t('common.emptyList')}
                    </td>
                  </tr>
                )}
            </tbody>
          </DataTable>
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

      <MessagingSendDialog open={sendOpen} onOpenChange={setSendOpen} />
      <ConfirmDeleteDialog
        open={deleteTarget != null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
        isPending={deleteMutation.isPending}
        title={t('plugins.messaging.delete.title')}
        description={t('plugins.messaging.delete.confirm')}
      />
    </PageContainer>
  )
}
