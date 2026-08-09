import { useTranslation } from 'react-i18next'
import { dashboardEnterClass, dashboardSectionClass } from '@/features/dashboard/lib/dashboard-styles'
import { cn } from '@/lib/utils'

export function DashboardRecentActivity() {
  const { t } = useTranslation()

  return (
    <section className={cn(dashboardSectionClass(), dashboardEnterClass(5))}>
      <div className="mb-4">
        <h2 className="text-lg font-semibold tracking-tight">{t('dashboard.recentActivity.title')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('dashboard.recentActivity.description')}</p>
      </div>

      <div className="rounded-lg border border-dashed border-border/70 px-4 py-8 dark:border-[#242424]">
        <p className="text-sm font-medium text-foreground">{t('dashboard.recentActivity.emptyTitle')}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('dashboard.recentActivity.emptyDescription')}
        </p>
      </div>
    </section>
  )
}
