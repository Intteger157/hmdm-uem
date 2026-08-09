import { Link } from '@tanstack/react-router'
import { FileUp, PackagePlus, Plus, Settings2, UsersRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { usePermissions } from '@/features/auth/hooks/use-permissions'
import { useDashboardPlatform } from '@/features/dashboard/hooks/use-dashboard-fleet-devices'
import { dashboardEnterClass, dashboardSectionClass } from '@/features/dashboard/lib/dashboard-styles'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function DashboardQuickActions() {
  const { t } = useTranslation()
  const { canMutate } = usePermissions()
  const platform = useDashboardPlatform()

  if (!canMutate) {
    return null
  }

  const actions =
    platform === 'windows'
      ? [
          { label: t('dashboard.quickActions.enrollDevice'), icon: Plus, to: '/windows/enrollment' },
          {
            label: t('dashboard.quickActions.createConfiguration'),
            icon: Settings2,
            to: '/windows/configurations/new',
          },
          {
            label: t('dashboard.quickActions.addApplication'),
            icon: PackagePlus,
            to: '/windows/applications',
          },
          { label: t('dashboard.quickActions.uploadFile'), icon: FileUp, to: '/windows/files' },
        ]
      : [
          {
            label: t('dashboard.quickActions.createConfiguration'),
            icon: Settings2,
            to: '/configurations/new',
          },
          { label: t('dashboard.quickActions.addApplication'), icon: PackagePlus, to: '/applications' },
          { label: t('dashboard.quickActions.uploadFile'), icon: FileUp, to: '/files' },
          { label: t('dashboard.quickActions.createGroup'), icon: UsersRound, to: '/groups' },
        ]

  return (
    <section className={cn(dashboardSectionClass(), dashboardEnterClass(3))}>
      <div className="mb-4">
        <h2 className="text-base font-semibold tracking-tight">{t('dashboard.quickActions.title')}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{t('dashboard.quickActions.description')}</p>
      </div>
      <div className="flex flex-col gap-2">
        {actions.map((action) => {
          const Icon = action.icon
          return (
            <Button
              key={action.to}
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 justify-start gap-2 px-2 text-sm font-normal text-muted-foreground hover:text-foreground"
              render={<Link to={action.to} />}
            >
              <Icon className="size-4 shrink-0" />
              {action.label}
            </Button>
          )
        })}
      </div>
    </section>
  )
}

export function DashboardQuickActionsInline() {
  const { t } = useTranslation()
  const { canMutate } = usePermissions()
  const platform = useDashboardPlatform()

  if (!canMutate) {
    return null
  }

  const enrollPath = platform === 'windows' ? '/windows/enrollment' : '/devices'
  const configPath =
    platform === 'windows' ? '/windows/configurations/new' : '/configurations/new'

  return (
    <div className={cn('flex flex-wrap gap-2', dashboardEnterClass(1))}>
      <Button type="button" variant="outline" size="sm" className="h-8" render={<Link to={enrollPath} />}>
        <Plus className="size-3.5" />
        {t('dashboard.quickActions.enrollDevice')}
      </Button>
      <Button type="button" variant="outline" size="sm" className="h-8" render={<Link to={configPath} />}>
        <Settings2 className="size-3.5" />
        {t('dashboard.quickActions.createConfiguration')}
      </Button>
      {platform === 'android' ? (
        <Button type="button" variant="outline" size="sm" className="h-8" render={<Link to="/groups" />}>
          <UsersRound className="size-3.5" />
          {t('dashboard.quickActions.createGroup')}
        </Button>
      ) : null}
    </div>
  )
}
