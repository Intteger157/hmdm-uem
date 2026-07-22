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
import { ConfigurationsListPage } from '@/features/configurations/pages/ConfigurationsListPage'
import { ConfigurationEditorPage } from '@/features/configurations/pages/ConfigurationEditorPage'
import { ApplicationsListPage } from '@/features/applications/pages/ApplicationsListPage'
import { ApplicationVersionsPage } from '@/features/applications/pages/ApplicationVersionsPage'
import { GroupsListPage } from '@/features/groups/pages/GroupsListPage'
import { UsersListPage } from '@/features/users/pages/UsersListPage'
import { SettingsPage } from '@/features/settings/pages/SettingsPage'
import { RolesListPage } from '@/features/roles/pages/RolesListPage'
import { RemoteControlSettingsPage } from '@/features/plugins/deviceremote/pages/RemoteControlSettingsPage'
import { PushListPage } from '@/features/plugins/push/pages/PushListPage'
import { MessagingListPage } from '@/features/plugins/messaging/pages/MessagingListPage'
import { AppLayout } from '@/layouts/AppLayout'
import { AuthLayout } from '@/layouts/AuthLayout'
import { FilesListPage } from '@/features/files/pages/FilesListPage'
import { PublicQrEnrollmentPage } from '@/features/devices/pages/PublicQrEnrollmentPage'
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
  component: ConfigurationsListPage,
})

const configurationEditorRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/configurations/$configId',
  component: function ConfigurationEditorRoute() {
    const { configId } = configurationEditorRoute.useParams()
    return <ConfigurationEditorPage configId={Number(configId)} />
  },
})

const applicationsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/applications',
  component: ApplicationsListPage,
})

const applicationVersionsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/applications/$applicationId',
  component: function ApplicationVersionsRoute() {
    const { applicationId } = applicationVersionsRoute.useParams()
    return <ApplicationVersionsPage applicationId={Number(applicationId)} />
  },
})

const filesRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/files',
  component: FilesListPage,
})

const groupsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/groups',
  component: GroupsListPage,
})

const usersRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/users',
  component: UsersListPage,
})

const settingsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/settings',
  component: SettingsPage,
})

const rolesRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/roles',
  component: RolesListPage,
})

const remoteControlRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/plugins/remote-control',
  component: RemoteControlSettingsPage,
})

const pushRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/plugins/push',
  component: PushListPage,
})

const messagingRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/plugins/messaging',
  component: MessagingListPage,
})

const publicQrRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/qr/$qrCodeKey',
  validateSearch: (search: Record<string, unknown>) => ({
    deviceId: typeof search.deviceId === 'string' ? search.deviceId : '',
    name: typeof search.name === 'string' ? search.name : '',
    size:
      typeof search.size === 'string' && !Number.isNaN(Number(search.size))
        ? Number(search.size)
        : 280,
  }),
  component: function PublicQrRoute() {
    const { qrCodeKey } = publicQrRoute.useParams()
    const { deviceId, name, size } = publicQrRoute.useSearch()
    return (
      <PublicQrEnrollmentPage
        qrCodeKey={qrCodeKey}
        deviceId={deviceId}
        deviceName={name}
        qrSize={size}
      />
    )
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
  publicQrRoute,
  authLayoutRoute.addChildren([loginRoute]),
  appLayoutRoute.addChildren([
    indexRoute,
    dashboardRoute,
    devicesRoute,
    deviceDetailRoute,
    configurationsRoute,
    configurationEditorRoute,
    applicationsRoute,
    applicationVersionsRoute,
    filesRoute,
    groupsRoute,
    usersRoute,
    settingsRoute,
    rolesRoute,
    remoteControlRoute,
    pushRoute,
    messagingRoute,
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
