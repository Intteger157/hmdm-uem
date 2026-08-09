import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import type { LucideIcon } from 'lucide-react'
import { Box, Monitor, Settings, Upload, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { usePermissions } from '@/features/auth/hooks/use-permissions'
import { dashboardEnterClass, dashboardSectionClass } from '@/features/dashboard/lib/dashboard-styles'
import { cn } from '@/lib/utils'

const linkClassName =
  'flex items-center gap-2 -ml-1.5 rounded-md p-1.5 text-sm text-slate-300 transition-colors hover:bg-white/5 hover:text-white'

interface QuickActionLinkProps {
  to: string
  icon: LucideIcon
  label: string
}

function QuickActionLink({ to, icon: Icon, label }: QuickActionLinkProps) {
  return (
    <Link to={to} className={linkClassName}>
      <Icon className="size-4 shrink-0 text-slate-400" aria-hidden />
      <span>{label}</span>
    </Link>
  )
}

interface QuickActionColumnProps {
  title: string
  children: ReactNode
}

function QuickActionColumn({ title, children }: QuickActionColumnProps) {
  return (
    <div className="min-w-0">
      <span className="mb-2 block text-xs font-medium uppercase tracking-wider text-slate-500">{title}</span>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  )
}

export function DashboardQuickActions() {
  const { t } = useTranslation()
  const { canMutate, allowsPlatform } = usePermissions()

  if (!canMutate) {
    return null
  }

  const showAndroid = allowsPlatform('android')
  const showWindows = allowsPlatform('windows')

  if (!showAndroid && !showWindows) {
    return null
  }

  const columnCount = showAndroid && showWindows ? 2 : 1

  return (
    <section className={cn(dashboardSectionClass(), dashboardEnterClass(3), 'h-full')}>
      <div className="mb-4">
        <h2 className="text-base font-semibold tracking-tight">{t('dashboard.quickActions.title')}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{t('dashboard.quickActions.description')}</p>
      </div>

      <div
        className={cn(
          'grid gap-4 sm:gap-6',
          columnCount === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1',
        )}
      >
        {showAndroid ? (
          <QuickActionColumn title={t('dashboard.quickActions.androidSection')}>
            <QuickActionLink
              to="/configurations/new"
              icon={Settings}
              label={t('dashboard.quickActions.createConfiguration')}
            />
            <QuickActionLink
              to="/applications"
              icon={Box}
              label={t('dashboard.quickActions.addApplication')}
            />
            <QuickActionLink
              to="/files"
              icon={Upload}
              label={t('dashboard.quickActions.uploadFile')}
            />
            <QuickActionLink
              to="/groups"
              icon={Users}
              label={t('dashboard.quickActions.createGroup')}
            />
          </QuickActionColumn>
        ) : null}

        {showWindows ? (
          <QuickActionColumn title={t('dashboard.quickActions.windowsSection')}>
            <QuickActionLink
              to="/windows/configurations/new"
              icon={Settings}
              label={t('dashboard.quickActions.createConfiguration')}
            />
            <QuickActionLink
              to="/windows/applications"
              icon={Box}
              label={t('dashboard.quickActions.addApplication')}
            />
            <QuickActionLink
              to="/windows/files"
              icon={Upload}
              label={t('dashboard.quickActions.uploadFile')}
            />
            <QuickActionLink
              to="/windows/enrollment"
              icon={Monitor}
              label={t('dashboard.quickActions.enrollment')}
            />
          </QuickActionColumn>
        ) : null}
      </div>
    </section>
  )
}

export function DashboardQuickActionsInline() {
  const { t } = useTranslation()
  const { canMutate, allowsPlatform } = usePermissions()

  if (!canMutate) {
    return null
  }

  const showAndroid = allowsPlatform('android')
  const showWindows = allowsPlatform('windows')

  return (
    <div className={cn('flex flex-wrap gap-2', dashboardEnterClass(1))}>
      {showWindows ? (
        <Link to="/windows/enrollment" className={cn(linkClassName, 'inline-flex px-2.5 py-1')}>
          <Monitor className="size-3.5 shrink-0" aria-hidden />
          {t('dashboard.quickActions.enrollment')}
        </Link>
      ) : null}
      {showAndroid ? (
        <Link to="/configurations/new" className={cn(linkClassName, 'inline-flex px-2.5 py-1')}>
          <Settings className="size-3.5 shrink-0" aria-hidden />
          {t('dashboard.quickActions.createConfiguration')}
        </Link>
      ) : null}
      {showWindows ? (
        <Link to="/windows/configurations/new" className={cn(linkClassName, 'inline-flex px-2.5 py-1')}>
          <Settings className="size-3.5 shrink-0" aria-hidden />
          {t('dashboard.quickActions.createConfiguration')}
        </Link>
      ) : null}
      {showAndroid ? (
        <Link to="/groups" className={cn(linkClassName, 'inline-flex px-2.5 py-1')}>
          <Users className="size-3.5 shrink-0" aria-hidden />
          {t('dashboard.quickActions.createGroup')}
        </Link>
      ) : null}
    </div>
  )
}
