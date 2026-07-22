import { Outlet, useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { AppSidebar } from '@/layouts/AppSidebar'
import { useAuthStore } from '@/features/auth/store/auth-store'
import { setAppLanguage } from '@/shared/lib/i18n'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'
import { SidebarFooter, SidebarHeader, SidebarProvider } from '@/components/ui/sidebar'
import { TooltipProvider } from '@/components/ui/tooltip'

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
    <TooltipProvider>
      <SidebarProvider defaultOpen className="min-h-svh w-full">
        <div className="flex min-h-svh min-w-0 flex-1 bg-background text-foreground">
          <aside className="flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
            <SidebarHeader className="border-b border-sidebar-border px-4 py-5">
              <p className="text-lg font-semibold">{t('app.title')}</p>
              <p className="text-xs text-muted-foreground">v2 preview</p>
            </SidebarHeader>
            <AppSidebar />
            <SidebarFooter className="space-y-4 border-t border-sidebar-border p-4">
              <ThemeToggle />
              <div>
                <label className="mb-2 block text-xs font-medium text-muted-foreground">
                  {t('nav.language')}
                </label>
                <select
                  className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                  value={i18n.language.startsWith('ru') ? 'ru' : 'en'}
                  onChange={(e) => setAppLanguage(e.target.value as 'en' | 'ru')}
                >
                  <option value="en">{t('language.en')}</option>
                  <option value="ru">{t('language.ru')}</option>
                </select>
              </div>
            </SidebarFooter>
          </aside>

          <div className="flex min-w-0 flex-1 flex-col">
            <header className="flex w-full items-center justify-between border-b border-border bg-card px-6 py-4">
              <div />
              <div className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground">{user?.name ?? user?.login}</span>
                <Button type="button" variant="outline" size="sm" onClick={handleLogout}>
                  {t('nav.logout')}
                </Button>
              </div>
            </header>
            <main className="w-full flex-1 p-6">
              <Outlet />
            </main>
          </div>
        </div>
      </SidebarProvider>
    </TooltipProvider>
  )
}
