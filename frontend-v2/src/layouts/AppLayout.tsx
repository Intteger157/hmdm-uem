import { useEffect } from 'react'
import { Outlet, useNavigate, useRouterState } from '@tanstack/react-router'
import { AppSidebar } from '@/layouts/AppSidebar'
import { AppTopBar } from '@/layouts/AppTopBar'
import { useConsoleAccessSync } from '@/features/auth/hooks/use-console-access-sync'
import { useAuthStore } from '@/features/auth/store/auth-store'
import {
  Sidebar,
  SidebarInset,
  SidebarProvider,
  useSidebar,
} from '@/components/ui/sidebar'
import { TooltipProvider } from '@/components/ui/tooltip'

/** Close the mobile drawer after route changes (sidebar link selected). */
function CloseMobileSidebarOnNavigate() {
  const { setOpenMobile } = useSidebar()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const searchStr = useRouterState({ select: (state) => state.location.searchStr })

  useEffect(() => {
    setOpenMobile(false)
  }, [pathname, searchStr, setOpenMobile])

  return null
}

function AppLayoutShell() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)

  useConsoleAccessSync()

  const handleLogout = () => {
    logout()
    void navigate({ to: '/login' })
  }

  return (
    <>
      <CloseMobileSidebarOnNavigate />
      <AppTopBar userLabel={user?.name ?? user?.login} onLogout={handleLogout} />

      <div className="flex min-h-0 w-full flex-1 overflow-hidden bg-background text-foreground">
        <Sidebar collapsible="offcanvas" className="border-r border-sidebar-border">
          <AppSidebar />
        </Sidebar>

        <SidebarInset className="min-h-0 min-w-0 w-full overflow-y-auto p-4 md:p-6">
          <div className="mx-auto w-full max-w-none">
            <Outlet />
          </div>
        </SidebarInset>
      </div>
    </>
  )
}

export function AppLayout() {
  return (
    <TooltipProvider>
      <SidebarProvider
        defaultOpen
        data-app-shell
        className="flex h-svh max-h-svh min-h-0 w-full flex-col overflow-hidden"
      >
        <AppLayoutShell />
      </SidebarProvider>
    </TooltipProvider>
  )
}
