import {
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
} from '@tanstack/react-router'
import { LoginPage } from '@/features/auth/pages/LoginPage'
import { DashboardPage } from '@/features/dashboard/pages/DashboardPage'
import { DevicesPage } from '@/features/devices/pages/DevicesPage'
import { AppLayout } from '@/layouts/AppLayout'
import { AuthLayout } from '@/layouts/AuthLayout'
import { useAuthStore } from '@/features/auth/store/auth-store'
import { isPlatform } from '@/shared/api/types/platform'

const rootRoute = createRootRoute({
  component: () => <Outlet />,
})

const authLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'auth-layout',
  component: AuthLayout,
})

const loginRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: '/login',
  beforeLoad: () => {
    if (useAuthStore.getState().isAuthenticated()) {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: LoginPage,
})

const appLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'app-layout',
  beforeLoad: () => {
    if (!useAuthStore.getState().isAuthenticated()) {
      throw redirect({ to: '/login' })
    }
  },
  component: AppLayout,
})

const dashboardRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/dashboard',
  component: DashboardPage,
})

const devicesRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/devices',
  validateSearch: (search: Record<string, unknown>) => ({
    platform: isPlatform(search.platform as string | undefined)
      ? (search.platform as 'android' | 'windows')
      : 'android',
  }),
  component: function DevicesRoute() {
    const { platform } = devicesRoute.useSearch()
    return <DevicesPage platform={platform} />
  },
})

const indexRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/dashboard' })
  },
})

const routeTree = rootRoute.addChildren([
  authLayoutRoute.addChildren([loginRoute]),
  appLayoutRoute.addChildren([indexRoute, dashboardRoute, devicesRoute]),
])

export const router = createRouter({
  routeTree,
  basepath: '/v2',
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
