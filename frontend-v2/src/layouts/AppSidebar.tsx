import { Link, useRouterState } from '@tanstack/react-router'
import {
  ChevronDown,
  FolderOpen,
  LayoutDashboard,
  MessageSquare,
  Monitor,
  Package,
  Radio,
  Shield,
  SlidersHorizontal,
  Settings,
  Smartphone,
  Terminal,
  Users,
  UsersRound,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

const navLinkClass =
  'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 [&.active]:bg-slate-900 [&.active]:text-white'

const subLinkClass =
  'block rounded-md px-3 py-1.5 pl-9 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900 [&.active]:bg-slate-200 [&.active]:font-medium [&.active]:text-slate-900'

export function AppSidebar() {
  const { t } = useTranslation()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const devicesOpenDefault = pathname.startsWith('/devices')
  const pluginsOpenDefault = pathname.startsWith('/plugins')
  const [devicesOpen, setDevicesOpen] = useState(devicesOpenDefault)
  const [pluginsOpen, setPluginsOpen] = useState(pluginsOpenDefault)

  return (
    <nav className="flex flex-1 flex-col gap-1 p-4">
      <Link to="/dashboard" className={navLinkClass}>
        <LayoutDashboard className="size-4 shrink-0" />
        {t('nav.dashboard')}
      </Link>

      <div>
        <button
          type="button"
          onClick={() => setDevicesOpen((open) => !open)}
          className={cn(
            'flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100',
            pathname.startsWith('/devices') && 'bg-slate-100',
          )}
        >
          <Smartphone className="size-4 shrink-0" />
          <span className="flex-1 text-left">{t('nav.devices')}</span>
          <ChevronDown
            className={cn('size-4 shrink-0 transition-transform', devicesOpen && 'rotate-180')}
          />
        </button>
        {devicesOpen && (
          <div className="mt-0.5 space-y-0.5">
            <Link
              to="/devices"
              search={{ platform: 'android' }}
              className={subLinkClass}
              activeOptions={{ exact: false, includeSearch: true }}
            >
              {t('nav.devicesAndroid')}
            </Link>
            <Link
              to="/devices"
              search={{ platform: 'windows' }}
              className={subLinkClass}
              activeOptions={{ exact: false, includeSearch: true }}
            >
              {t('nav.devicesWindows')}
            </Link>
          </div>
        )}
      </div>

      <Link to="/configurations" className={navLinkClass}>
        <SlidersHorizontal className="size-4 shrink-0" />
        {t('nav.configurations')}
      </Link>
      <Link to="/applications" className={navLinkClass}>
        <Package className="size-4 shrink-0" />
        {t('nav.applications')}
      </Link>
      <Link to="/files" className={navLinkClass}>
        <FolderOpen className="size-4 shrink-0" />
        {t('nav.files')}
      </Link>
      <Link to="/groups" className={navLinkClass}>
        <UsersRound className="size-4 shrink-0" />
        {t('nav.groups')}
      </Link>
      <Link to="/users" className={navLinkClass}>
        <Users className="size-4 shrink-0" />
        {t('nav.users')}
      </Link>
      <Link to="/roles" className={navLinkClass}>
        <Shield className="size-4 shrink-0" />
        {t('nav.roles')}
      </Link>
      <Link to="/settings" className={navLinkClass}>
        <Settings className="size-4 shrink-0" />
        {t('nav.settings')}
      </Link>

      <div className="mt-2 border-t border-slate-200 pt-2">
        <button
          type="button"
          onClick={() => setPluginsOpen((open) => !open)}
          className={cn(
            'flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100',
            pathname.startsWith('/plugins') && 'bg-slate-100',
          )}
        >
          <Monitor className="size-4 shrink-0" />
          <span className="flex-1 text-left">{t('nav.plugins')}</span>
          <ChevronDown
            className={cn('size-4 shrink-0 transition-transform', pluginsOpen && 'rotate-180')}
          />
        </button>
        {pluginsOpen && (
          <div className="mt-0.5 space-y-0.5">
            <Link to="/plugins/remote-control" className={cn(subLinkClass, 'flex items-center gap-2')}>
              <Terminal className="size-3.5 shrink-0" />
              {t('nav.remoteControl')}
            </Link>
            <Link to="/plugins/push" className={cn(subLinkClass, 'flex items-center gap-2')}>
              <Radio className="size-3.5 shrink-0" />
              {t('nav.push')}
            </Link>
            <Link to="/plugins/messaging" className={cn(subLinkClass, 'flex items-center gap-2')}>
              <MessageSquare className="size-3.5 shrink-0" />
              {t('nav.messaging')}
            </Link>
          </div>
        )}
      </div>
    </nav>
  )
}
