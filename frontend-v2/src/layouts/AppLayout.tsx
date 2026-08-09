import { useEffect } from 'react'
import { Outlet, useNavigate, useRouterState } from '@tanstack/react-router'
import { AppSidebar } from '@/layouts/AppSidebar'
import { AppTopBar } from '@/layouts/AppTopBar'
import { useConsoleAccessSync } from '@/features/auth/hooks/use-console-access-sync'
import { useAuthStore } from '@/features/auth/store/auth-store'
import { useIsMobile } from '@/hooks/use-mobile'
import {
  Sidebar,
  SidebarInset,
  SidebarProvider,
  useSidebar,
} from '@/components/ui/sidebar'
import { TooltipProvider } from '@/components/ui/tooltip'
import { GlobalUploadManager } from '@/features/upload/components/GlobalUploadManager'

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

/** Lock page scroll and support Escape while the mobile drawer is open. */
function MobileSidebarBehavior() {
  const { isMobile, openMobile, setOpenMobile } = useSidebar()

  useEffect(() => {
    if (!isMobile) {
      setOpenMobile(false)
    }
  }, [isMobile, setOpenMobile])

  useEffect(() => {
    if (!isMobile || !openMobile) {
      return
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenMobile(false)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [isMobile, openMobile, setOpenMobile])

  return null
}

function AppLayoutShell() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const isMobile = useIsMobile()

  useConsoleAccessSync()

  const handleLogout = () => {
    logout()
    void navigate({ to: '/login' })
  }

  return (
    <>
      <CloseMobileSidebarOnNavigate />
      <MobileSidebarBehavior />
      <AppTopBar userLabel={user?.name ?? user?.login} onLogout={handleLogout} />

      <div className="flex min-h-0 w-full flex-1 overflow-hidden bg-background text-foreground">
        <Sidebar
          collapsible={isMobile ? 'offcanvas' : 'none'}
          className="min-h-0 shrink-0 border-r border-sidebar-border"
        >
          <AppSidebar />
        </Sidebar>

        <SidebarInset className="min-h-0 min-w-0 w-full overflow-y-auto p-4 md:p-6">
          <div className="mx-auto w-full max-w-none">
            <Outlet />
          </div>
        </SidebarInset>
      </div>

      <GlobalUploadManager />
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
