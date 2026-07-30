import { Outlet, useNavigate } from '@tanstack/react-router'
import { AppSidebar } from '@/layouts/AppSidebar'
import { AppTopBar } from '@/layouts/AppTopBar'
import { useConsoleAccessSync } from '@/features/auth/hooks/use-console-access-sync'
import { useAuthStore } from '@/features/auth/store/auth-store'
import { SidebarProvider } from '@/components/ui/sidebar'
import { TooltipProvider } from '@/components/ui/tooltip'

export function AppLayout() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)

  useConsoleAccessSync()

  const handleLogout = () => {
    logout()
    void navigate({ to: '/login' })
  }

  return (
    <TooltipProvider>
      <SidebarProvider
        defaultOpen
        data-app-shell
        className="flex h-svh max-h-svh min-h-0 w-full flex-col overflow-hidden"
      >
        <AppTopBar
          userLabel={user?.name ?? user?.login}
          onLogout={handleLogout}
        />

        <div className="flex min-h-0 w-full flex-1 overflow-hidden bg-background text-foreground">
          <aside className="flex min-h-0 w-64 shrink-0 flex-col overflow-y-auto border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
            <AppSidebar />
          </aside>

          <main className="min-h-0 min-w-0 flex-1 overflow-y-auto p-6">
            <Outlet />
          </main>
        </div>
      </SidebarProvider>
    </TooltipProvider>
  )
}
