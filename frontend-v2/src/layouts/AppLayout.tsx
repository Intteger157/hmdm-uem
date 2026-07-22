import { Outlet, useNavigate } from '@tanstack/react-router'
import { AppSidebar } from '@/layouts/AppSidebar'
import { AppTopBar } from '@/layouts/AppTopBar'
import { useAuthStore } from '@/features/auth/store/auth-store'
import { SidebarProvider } from '@/components/ui/sidebar'
import { TooltipProvider } from '@/components/ui/tooltip'

export function AppLayout() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)

  const handleLogout = () => {
    logout()
    void navigate({ to: '/login' })
  }

  return (
    <TooltipProvider>
      <SidebarProvider defaultOpen className="flex min-h-svh w-full flex-col">
        <AppTopBar
          userLabel={user?.name ?? user?.login}
          onLogout={handleLogout}
        />

        <div className="flex min-h-0 min-w-0 flex-1 bg-background text-foreground">
          <aside className="flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
            <AppSidebar />
          </aside>

          <main className="min-w-0 flex-1 overflow-auto p-6">
            <Outlet />
          </main>
        </div>
      </SidebarProvider>
    </TooltipProvider>
  )
}
