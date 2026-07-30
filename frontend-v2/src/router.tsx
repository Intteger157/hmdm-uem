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
import { PublicDeviceInfoPage } from '@/features/devices/pages/PublicDeviceInfoPage'
import { WindowsConfigurationsPage } from '@/features/windows/configurations/pages/WindowsConfigurationsPage'
import { WindowsConfigEditorPage } from '@/features/windows/configurations/pages/WindowsConfigEditorPage'
import { WindowsAppCatalogPage } from '@/features/windows/applications/pages/WindowsAppCatalogPage'
import { WindowsFilesPage } from '@/features/windows/files/pages/WindowsFilesPage'
import { WindowsScriptsPage } from '@/features/windows/scripts/pages/WindowsScriptsPage'
import { WindowsEnrollmentPage } from '@/features/windows/enrollment/pages/WindowsEnrollmentPage'
import { useAuthStore } from '@/features/auth/store/auth-store'
import { resolvePermissions } from '@/features/auth/hooks/use-permissions'
import { isPlatform, type Platform } from '@/shared/api/types/platform'

const rootRoute = createRootRoute({
  component: () => <Outlet />,
})

/**
 * Keeps a role out of the ecosystem it is not scoped to.
 *
 * The sidebar already hides these entries, so this only catches bookmarks,
 * typed URLs and back-button navigation.
 *
 * This is not a security boundary. Go rejects out-of-scope calls to the Windows
 * routes, but the Android routes are still served by Java, which does not read
 * platform_scope at all — those checks arrive when the routes move to Go.
 */
function requirePlatform(platform: Platform) {
  return () => {
    if (!useAuthStore.getState().allowsPlatform(platform)) {
      throw redirect({ to: '/dashboard' })
    }
  }
}

/** Rewrites ?platform= on the device routes to the one the role can manage. */
function requireScopedDevicePlatform({ search }: { search: { platform: Platform } }) {
  const locked = useAuthStore.getState().scopedPlatform()
  if (locked && search.platform !== locked) {
    throw redirect({ to: '/devices', search: { platform: locked } })
  }
}

/**
 * Keeps the console's own administration out of reach of the roles it governs.
 *
 * These pages are served by Java, which does not read the matrix columns, so
 * every request from a non-administrator would come back 403 and the screens
 * would render as a wall of errors. Redirecting is both the friendlier outcome
 * and, on the Java side, the only one available today.
 */
function requireAdministrator() {
  if (!resolvePermissions(useAuthStore.getState().access).isAdministrator) {
    throw redirect({ to: '/dashboard' })
  }
}

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
  beforeLoad: requireScopedDevicePlatform,
  component: function DevicesRoute() {
    const { platform } = devicesRoute.useSearch()
    return <DevicesPage platform={platform} />
  },
})

const deviceDetailRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/devices/$deviceNumber',
  validateSearch: (search: Record<string, unknown>) => ({
    platform: isPlatform(search.platform as string | undefined)
      ? (search.platform as 'android' | 'windows')
      : 'android',
  }),
  beforeLoad: requireScopedDevicePlatform,
  component: function DeviceDetailRoute() {
    const { deviceNumber } = deviceDetailRoute.useParams()
    const { platform } = deviceDetailRoute.useSearch()
    return <DeviceDetailPage deviceNumber={deviceNumber} platform={platform} />
  },
})

const configurationsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/configurations',
  beforeLoad: requirePlatform('android'),
  component: ConfigurationsListPage,
})

const configurationCreateRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/configurations/new',
  beforeLoad: requirePlatform('android'),
  component: function ConfigurationCreateRoute() {
    return <ConfigurationEditorPage isNew />
  },
})

const configurationEditorRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/configurations/$configId',
  beforeLoad: requirePlatform('android'),
  component: function ConfigurationEditorRoute() {
    const { configId } = configurationEditorRoute.useParams()
    return <ConfigurationEditorPage configId={Number(configId)} />
  },
})

const applicationsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/applications',
  beforeLoad: requirePlatform('android'),
  component: ApplicationsListPage,
})

const applicationVersionsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/applications/$applicationId',
  beforeLoad: requirePlatform('android'),
  component: function ApplicationVersionsRoute() {
    const { applicationId } = applicationVersionsRoute.useParams()
    return <ApplicationVersionsPage applicationId={Number(applicationId)} />
  },
})

const filesRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/files',
  beforeLoad: requirePlatform('android'),
  component: FilesListPage,
})

const groupsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/groups',
  beforeLoad: requirePlatform('android'),
  component: GroupsListPage,
})

const usersRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/users',
  beforeLoad: requireAdministrator,
  component: UsersListPage,
})

const settingsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/settings',
  beforeLoad: requireAdministrator,
  component: SettingsPage,
})

const rolesRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/roles',
  beforeLoad: requireAdministrator,
  component: RolesListPage,
})

const remoteControlRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/plugins/remote-control',
  beforeLoad: requirePlatform('android'),
  component: RemoteControlSettingsPage,
})

const pushRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/plugins/push',
  beforeLoad: requirePlatform('android'),
  component: PushListPage,
})

const messagingRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/plugins/messaging',
  beforeLoad: requirePlatform('android'),
  component: MessagingListPage,
})

const windowsConfigurationsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/windows/configurations',
  beforeLoad: requirePlatform('windows'),
  component: WindowsConfigurationsPage,
})

const windowsConfigurationCreateRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/windows/configurations/new',
  beforeLoad: requirePlatform('windows'),
  component: function WindowsConfigurationCreateRoute() {
    return <WindowsConfigEditorPage isNew />
  },
})

const windowsConfigurationEditorRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/windows/configurations/$profileId',
  beforeLoad: requirePlatform('windows'),
  component: function WindowsConfigurationEditorRoute() {
    const { profileId } = windowsConfigurationEditorRoute.useParams()
    return <WindowsConfigEditorPage profileId={Number(profileId)} />
  },
})

const windowsEnrollmentRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/windows/enrollment',
  beforeLoad: requirePlatform('windows'),
  component: WindowsEnrollmentPage,
})

const windowsScriptsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/windows/scripts',
  beforeLoad: requirePlatform('windows'),
  component: WindowsScriptsPage,
})

const windowsApplicationsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/windows/applications',
  beforeLoad: requirePlatform('windows'),
  component: WindowsAppCatalogPage,
})

const windowsFilesRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/windows/files',
  beforeLoad: requirePlatform('windows'),
  component: WindowsFilesPage,
})

const publicDeviceInfoRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/device-info/$deviceId',
  component: function PublicDeviceInfoRoute() {
    const { deviceId } = publicDeviceInfoRoute.useParams()
    return <PublicDeviceInfoPage deviceId={deviceId} />
  },
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
  publicDeviceInfoRoute,
  publicQrRoute,
  authLayoutRoute.addChildren([loginRoute]),
  appLayoutRoute.addChildren([
    indexRoute,
    dashboardRoute,
    devicesRoute,
    deviceDetailRoute,
    configurationsRoute,
    configurationCreateRoute,
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
    windowsConfigurationsRoute,
    windowsConfigurationCreateRoute,
    windowsConfigurationEditorRoute,
    windowsEnrollmentRoute,
    windowsScriptsRoute,
    windowsApplicationsRoute,
    windowsFilesRoute,
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
