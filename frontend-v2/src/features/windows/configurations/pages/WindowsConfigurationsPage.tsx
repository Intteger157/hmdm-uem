import { useCallback, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { Pencil, Plus, Star, Trash2 } from 'lucide-react'
import {
  useDeleteWindowsConfigProfileMutation,
  useWindowsConfigProfilesQuery,
} from '@/features/windows/configurations/hooks/use-windows-config-profiles'
import type { WindowsConfigProfile } from '@/features/windows/configurations/types/config-profile'
import {
  WINDOWS_GRID_CONFIGS,
  WindowsDataList,
  WindowsDataListBody,
  WindowsDataListCell,
  WindowsDataListEmpty,
  WindowsDataListHeader,
  WindowsDataListPanel,
  WindowsDataListRow,
} from '@/features/windows/components/WindowsDataList'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ConfirmDeleteDialog } from '@/shared/components/ConfirmDeleteDialog'
import { ListPagination } from '@/shared/components/ListPagination'
import { usePaginatedList } from '@/shared/hooks/use-paginated-list'
import { usePermissions } from '@/features/auth/hooks/use-permissions'
import { PageContainer, PageHeader, PageToolbar } from '@/shared/layout/page-layout'
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
  const { canMutate, canDeleteCritical } = usePermissions()
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
    <PageContainer size="wide">
      <PageHeader title={t('windowsConfigurations.title')} description={t('windowsConfigurations.subtitle')}>
        {canMutate && (
          <Button type="button" render={<Link to="/windows/configurations/new" />}>
            <Plus className="size-4" />
            {t('windowsConfigurations.createProfile')}
          </Button>
        )}
      </PageHeader>

      <PageToolbar>
        <form onSubmit={handleSearch} className="flex w-full max-w-xl flex-1 gap-2">
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t('windowsConfigurations.searchPlaceholder')}
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
        <WindowsDataList aria-label={t('windowsConfigurations.title')}>
              <WindowsDataListHeader gridClass={WINDOWS_GRID_CONFIGS}>
                <WindowsDataListCell role="columnheader">{t('windowsConfigurations.columns.name')}</WindowsDataListCell>
                <WindowsDataListCell role="columnheader">{t('windowsConfigurations.columns.status')}</WindowsDataListCell>
                <WindowsDataListCell role="columnheader">
                  {t('windowsConfigurations.columns.lastUpdated')}
                </WindowsDataListCell>
                {canMutate ? (
                  <WindowsDataListCell role="columnheader" className="text-right">
                    {t('windowsConfigurations.columns.actions')}
                  </WindowsDataListCell>
                ) : null}
              </WindowsDataListHeader>

              <WindowsDataListBody>
                {pageItems.length === 0 ? (
                  <WindowsDataListEmpty>{t('windowsConfigurations.empty')}</WindowsDataListEmpty>
                ) : (
                  pageItems.map((profile) => (
                    <WindowsDataListRow key={profile.id} gridClass={WINDOWS_GRID_CONFIGS}>
                      <WindowsDataListCell>
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <span className="truncate font-medium">{profile.name}</span>
                          {profile.isDefault ? (
                            <Badge className="shrink-0 border-violet-500/30 bg-violet-600/90 text-white hover:bg-violet-600/90">
                              <Star className="mr-1 size-3 fill-current" />
                              {t('windowsConfigurations.badge.default')}
                            </Badge>
                          ) : null}
                        </div>
                        {profile.description ? (
                          <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{profile.description}</div>
                        ) : null}
                      </WindowsDataListCell>
                      <WindowsDataListCell>
                        <Badge variant={profile.isActive ? 'default' : 'outline'}>
                          {profile.isActive
                            ? t('windowsConfigurations.status.active')
                            : t('windowsConfigurations.status.draft')}
                        </Badge>
                      </WindowsDataListCell>
                      <WindowsDataListCell className="whitespace-nowrap text-muted-foreground">
                        {formatTimestamp(profile.updatedAt)}
                      </WindowsDataListCell>
                      {canMutate ? (
                        <WindowsDataListCell className="flex justify-end">
                          <div className="flex flex-wrap justify-end gap-2">
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
                            {canDeleteCritical && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => setDeleteTarget(profile)}
                              >
                                <Trash2 className="mr-1.5 size-3.5" />
                                {t('common.delete')}
                              </Button>
                            )}
                          </div>
                        </WindowsDataListCell>
                      ) : null}
                    </WindowsDataListRow>
                  ))
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
    </PageContainer>
  )
}
