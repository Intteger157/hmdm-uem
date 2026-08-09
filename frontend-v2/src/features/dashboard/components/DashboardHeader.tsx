import { RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { formatRelativeTimeI18n } from '@/features/dashboard/lib/format-relative-time'
import { dashboardEnterClass } from '@/features/dashboard/lib/dashboard-styles'
import { cn } from '@/lib/utils'

interface DashboardHeaderProps {
  dataUpdatedAt: number
  isFetching: boolean
  onRefresh: () => void
}

export function DashboardHeader({ dataUpdatedAt, isFetching, onRefresh }: DashboardHeaderProps) {
  const { t } = useTranslation()
  const lastUpdated =
    dataUpdatedAt > 0
      ? formatRelativeTimeI18n(dataUpdatedAt, t)
      : t('dashboard.header.neverUpdated')

  return (
    <header
      className={cn(
        'flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between',
        dashboardEnterClass(),
      )}
    >
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
          {t('dashboard.title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('dashboard.subtitle')}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <span>
          {t('dashboard.header.lastUpdated', { time: lastUpdated })}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-2"
          disabled={isFetching}
          onClick={onRefresh}
        >
          <RefreshCw className={cn('size-3.5', isFetching && 'animate-spin')} />
          {t('dashboard.header.refresh')}
        </Button>
      </div>
    </header>
  )
}
