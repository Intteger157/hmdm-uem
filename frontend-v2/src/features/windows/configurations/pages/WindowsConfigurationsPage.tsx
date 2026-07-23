import { useCallback, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import {
  useDeleteWindowsConfigProfileMutation,
  useWindowsConfigProfilesQuery,
} from '@/features/windows/configurations/hooks/use-windows-config-profiles'
import type { WindowsConfigProfile } from '@/features/windows/configurations/types/config-profile'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ConfirmDeleteDialog } from '@/shared/components/ConfirmDeleteDialog'
import { ListPagination } from '@/shared/components/ListPagination'
import { usePaginatedList } from '@/shared/hooks/use-paginated-list'
import { toast } from 'sonner'

function matchProfile(profile: WindowsConfigProfile, query: string): boolean {
  return (
    profile.name.toLowerCase().includes(query) ||
    (profile.description ?? '').toLowerCase().includes(query)
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

export function WindowsConfigurationsPage() {
  const { t } = useTranslation()
  const { data, isLoading, error, refetch } = useWindowsConfigProfilesQuery()
  const deleteMutation = useDeleteWindowsConfigProfileMutation()

  const [searchInput, setSearchInput] = useState('')
  const [searchValue, setSearchValue] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<WindowsConfigProfile | null>(null)

  const matcher = useCallback(matchProfile, [])
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
      toast.success(t('windowsConfigurations.delete.success'))
      setDeleteTarget(null)
    } catch {
      toast.error(t('windowsConfigurations.delete.error'))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('windowsConfigurations.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('windowsConfigurations.subtitle')}</p>
        </div>
        <Button type="button" render={<Link to="/windows/configurations/new" />}>
          <Plus className="size-4" />
          {t('windowsConfigurations.createProfile')}
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <form onSubmit={handleSearch} className="flex max-w-xl flex-1 gap-2">
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t('windowsConfigurations.searchPlaceholder')}
          />
          <Button type="submit" variant="secondary">
            {t('common.search')}
          </Button>
        </form>
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
                    <th className="px-4 py-3 font-medium">{t('windowsConfigurations.columns.name')}</th>
                    <th className="px-4 py-3 font-medium">{t('windowsConfigurations.columns.status')}</th>
                    <th className="px-4 py-3 font-medium">{t('windowsConfigurations.columns.lastUpdated')}</th>
                    <th className="px-4 py-3 font-medium">{t('windowsConfigurations.columns.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((profile) => (
                    <tr key={profile.id} className="border-b last:border-0">
                      <td className="px-4 py-3">
                        <div className="font-medium">{profile.name}</div>
                        {profile.description ? (
                          <div className="mt-0.5 text-xs text-muted-foreground">{profile.description}</div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={profile.isActive ? 'default' : 'outline'}>
                          {profile.isActive
                            ? t('windowsConfigurations.status.active')
                            : t('windowsConfigurations.status.draft')}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{formatTimestamp(profile.updatedAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            render={
                              <Link
                                to="/windows/configurations/$profileId"
                                params={{ profileId: String(profile.id) }}
                              />
                            }
                          >
                            <Pencil className="mr-1.5 size-3.5" />
                            {t('common.edit')}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setDeleteTarget(profile)}
                          >
                            <Trash2 className="mr-1.5 size-3.5" />
                            {t('common.delete')}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {pageItems.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                        {t('windowsConfigurations.empty')}
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

      <ConfirmDeleteDialog
        open={deleteTarget != null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null)
          }
        }}
        title={t('windowsConfigurations.delete.title')}
        description={t('windowsConfigurations.delete.description', { name: deleteTarget?.name ?? '' })}
        confirmLabel={t('common.delete')}
        confirmVariant="destructive"
        isPending={deleteMutation.isPending}
        onConfirm={() => void handleDelete()}
      />
    </div>
  )
}
