import { useTranslation } from 'react-i18next'
import { useDeviceSummaryQuery } from '@/features/dashboard/hooks/use-device-summary-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export function DashboardPage() {
  const { t } = useTranslation()
  const { data, isLoading, error, refetch, isFetching } = useDeviceSummaryQuery()

  if (isLoading) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
        {t('dashboard.loading')}
      </div>
    )
  }

  if (error || !data) {
    return (
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-destructive">{t('dashboard.errorTitle')}</CardTitle>
          <CardDescription>{t('dashboard.errorDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button type="button" variant="outline" onClick={() => void refetch()}>
            {t('dashboard.retry')}
          </Button>
        </CardContent>
      </Card>
    )
  }

  const online = data.statusSummary.find((s) => s.stringAttr === 'Online')?.number ?? 0
  const offline = data.statusSummary.find((s) => s.stringAttr === 'Offline')?.number ?? 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('dashboard.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('dashboard.subtitle')}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title={t('dashboard.stats.total')}
          value={data.devicesTotal}
          hint={t('dashboard.stats.totalHint')}
        />
        <StatCard
          title={t('dashboard.stats.enrolled')}
          value={data.devicesEnrolled}
          hint={t('dashboard.stats.enrolledHint')}
        />
        <StatCard
          title={t('dashboard.stats.enrolledMonth')}
          value={data.devicesEnrolledLastMonth}
          hint={t('dashboard.stats.enrolledMonthHint')}
        />
        <StatCard
          title={t('dashboard.stats.online')}
          value={online}
          hint={t('dashboard.stats.onlineHint', { offline })}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.statusTitle')}</CardTitle>
            <CardDescription>{t('dashboard.statusDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.statusSummary.map((item) => (
              <div key={item.stringAttr} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{item.stringAttr}</span>
                <span className="font-medium">{item.number}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.installTitle')}</CardTitle>
            <CardDescription>{t('dashboard.installDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.installSummary.map((item) => (
              <div key={item.stringAttr} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{item.stringAttr}</span>
                <span className="font-medium">{item.number}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {isFetching && (
        <p className="text-xs text-muted-foreground">{t('dashboard.refreshing')}</p>
      )}
    </div>
  )
}

function StatCard({
  title,
  value,
  hint,
}: {
  title: string
  value: number
  hint: string
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-3xl tabular-nums">{value}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  )
}
