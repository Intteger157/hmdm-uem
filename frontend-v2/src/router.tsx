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
import { DeviceDetailPage } from '@/features/devices/pages/DeviceDetailPage'
import { AppLayout } from '@/layouts/AppLayout'
import { AuthLayout } from '@/layouts/AuthLayout'
import { ComingSoonPage } from '@/shared/pages/ComingSoonPage'
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

const deviceDetailRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/devices/$deviceNumber',
  component: function DeviceDetailRoute() {
    const { deviceNumber } = deviceDetailRoute.useParams()
    return <DeviceDetailPage deviceNumber={deviceNumber} />
  },
})

const configurationsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/configurations',
  component: () => <ComingSoonPage titleKey="nav.configurations" />,
})

const applicationsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/applications',
  component: () => <ComingSoonPage titleKey="nav.applications" />,
})

const filesRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/files',
  component: () => <ComingSoonPage titleKey="nav.files" />,
})

const groupsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/groups',
  component: () => <ComingSoonPage titleKey="nav.groups" />,
})

const usersRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/users',
  component: () => <ComingSoonPage titleKey="nav.users" />,
})

const settingsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/settings',
  component: () => <ComingSoonPage titleKey="nav.settings" />,
})

const remoteControlRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/plugins/remote-control',
  component: () => <ComingSoonPage titleKey="nav.remoteControl" />,
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
  appLayoutRoute.addChildren([
    indexRoute,
    dashboardRoute,
    devicesRoute,
    deviceDetailRoute,
    configurationsRoute,
    applicationsRoute,
    filesRoute,
    groupsRoute,
    usersRoute,
    settingsRoute,
    remoteControlRoute,
  ]),
])

export const router = createRouter({
  routeTree,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
