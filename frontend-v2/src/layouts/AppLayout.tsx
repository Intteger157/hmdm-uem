import { Link, Outlet, useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/features/auth/store/auth-store'
import { setAppLanguage } from '@/shared/lib/i18n'

export function AppLayout() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)

  const handleLogout = () => {
    logout()
    void navigate({ to: '/login' })
  }

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <aside className="flex w-64 flex-col border-r border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-6 py-5">
          <p className="text-lg font-semibold">{t('app.title')}</p>
          <p className="text-xs text-slate-500">v2 preview</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-4">
          <Link
            to="/dashboard"
            className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 [&.active]:bg-slate-900 [&.active]:text-white"
          >
            {t('nav.dashboard')}
          </Link>
          <Link
            to="/devices"
            search={{ platform: 'android' }}
            className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 [&.active]:bg-slate-900 [&.active]:text-white"
          >
            {t('nav.devices')}
          </Link>
        </nav>
        <div className="border-t border-slate-200 p-4">
          <label className="mb-2 block text-xs font-medium text-slate-500">Language</label>
          <select
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            value={i18n.language.startsWith('ru') ? 'ru' : 'en'}
            onChange={(e) => setAppLanguage(e.target.value as 'en' | 'ru')}
          >
            <option value="en">{t('language.en')}</option>
            <option value="ru">{t('language.ru')}</option>
          </select>
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div />
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-600">{user?.name ?? user?.login}</span>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
            >
              {t('nav.logout')}
            </button>
          </div>
        </header>
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
