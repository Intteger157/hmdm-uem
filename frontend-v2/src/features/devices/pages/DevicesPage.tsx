import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { DeviceTable } from '@/features/devices/components/DeviceTable'
import { useDevicesQuery } from '@/features/devices/hooks/use-devices-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { isPlatform } from '@/shared/api/types/platform'

const PAGE_SIZE = 50

interface DevicesPageProps {
  platform: string | undefined
}

export function DevicesPage({ platform: platformParam }: DevicesPageProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const platform = isPlatform(platformParam) ? platformParam : 'android'

  const [pageNum, setPageNum] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [searchValue, setSearchValue] = useState<string | undefined>()

  const { data, isLoading, isFetching, error, refetch } = useDevicesQuery({
    platform,
    pageNum,
    pageSize: PAGE_SIZE,
    value: searchValue,
  })

  const totalItems = data?.devices.totalItemsCount ?? 0
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE))

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault()
    setPageNum(1)
    setSearchValue(searchInput.trim() || undefined)
  }

  const handlePlatformChange = (next: 'android' | 'windows') => {
    void navigate({
      to: '/devices',
      search: { platform: next },
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('devices.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('devices.subtitle')}</p>
        </div>
        <div className="flex rounded-lg border p-1">
          <Button
            type="button"
            size="sm"
            variant={platform === 'android' ? 'default' : 'ghost'}
            onClick={() => handlePlatformChange('android')}
          >
            Android
          </Button>
          <Button
            type="button"
            size="sm"
            variant={platform === 'windows' ? 'default' : 'ghost'}
            onClick={() => handlePlatformChange('windows')}
          >
            Windows
          </Button>
        </div>
      </div>

      {platform === 'windows' ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('devices.windowsStubTitle')}</CardTitle>
            <CardDescription>{t('devices.windowsStubDescription')}</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          <form onSubmit={handleSearch} className="flex max-w-xl gap-2">
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t('devices.searchPlaceholder')}
            />
            <Button type="submit" variant="secondary">
              {t('devices.search')}
            </Button>
          </form>

          {error && (
            <Card className="border-destructive/40">
              <CardHeader>
                <CardTitle className="text-destructive">{t('devices.errorTitle')}</CardTitle>
                <CardDescription>{t('devices.errorDescription')}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button type="button" variant="outline" onClick={() => void refetch()}>
                  {t('devices.retry')}
                </Button>
              </CardContent>
            </Card>
          )}

          {data && (
            <>
              <DeviceTable data={data} isLoading={isLoading || isFetching} />

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  {t('devices.paginationSummary', {
                    from: totalItems === 0 ? 0 : (pageNum - 1) * PAGE_SIZE + 1,
                    to: Math.min(pageNum * PAGE_SIZE, totalItems),
                    total: totalItems,
                  })}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pageNum <= 1 || isFetching}
                    onClick={() => setPageNum((p) => Math.max(1, p - 1))}
                  >
                    {t('devices.prevPage')}
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {t('devices.pageOf', { page: pageNum, total: totalPages })}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pageNum >= totalPages || isFetching}
                    onClick={() => setPageNum((p) => p + 1)}
                  >
                    {t('devices.nextPage')}
                  </Button>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
