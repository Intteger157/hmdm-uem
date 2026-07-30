import { Link, useRouterState } from '@tanstack/react-router'
import {
  ChevronRight,
  FolderOpen,
  LayoutDashboard,
  MessageSquare,
  Monitor,
  MonitorSmartphone,
  Package,
  Radio,
  Settings2,
  Shield,
  SlidersHorizontal,
  Settings,
  Smartphone,
  Terminal,
  Users,
  UsersRound,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarSeparator,
} from '@/components/ui/sidebar'
import { AndroidIcon, WindowsIcon } from '@/components/icons/platform-icons'
import { useAuthStore } from '@/features/auth/store/auth-store'
import { scopeAllowsPlatform, scopedPlatform } from '@/shared/lib/platform-scope'

function useNavState() {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const searchStr = useRouterState({ select: (state) => state.location.searchStr })
  const devicePlatform = searchStr.includes('platform=windows') ? 'windows' : 'android'

  return {
    pathname,
    devicePlatform,
    isDashboard: pathname === '/dashboard' || pathname === '/',
    isDevices: pathname.startsWith('/devices'),
    isDevicesAndroid: pathname.startsWith('/devices') && devicePlatform !== 'windows',
    isDevicesWindows: pathname === '/devices' && devicePlatform === 'windows',
    isConfigurations: pathname.startsWith('/configurations'),
    isApplications: pathname.startsWith('/applications'),
    isFiles: pathname.startsWith('/files'),
    isGroups: pathname.startsWith('/groups'),
    isPlugins:
      pathname.startsWith('/plugins/remote-control') ||
      pathname.startsWith('/plugins/push') ||
      pathname.startsWith('/plugins/messaging'),
    isRemoteControl: pathname.startsWith('/plugins/remote-control'),
    isPush: pathname.startsWith('/plugins/push'),
    isMessaging: pathname.startsWith('/plugins/messaging'),
    isUsers: pathname.startsWith('/users'),
    isRoles: pathname.startsWith('/roles'),
    isSettings: pathname.startsWith('/settings'),
    isWindowsConfigurations: pathname.startsWith('/windows/configurations'),
    isWindowsEnrollment: pathname.startsWith('/windows/enrollment'),
    isWindowsScripts: pathname.startsWith('/windows/scripts'),
    isWindowsApplications: pathname.startsWith('/windows/applications'),
    isWindowsFiles: pathname.startsWith('/windows/files'),
  }
}

type NavState = ReturnType<typeof useNavState>

function DevicesGroup({ nav }: { nav: NavState }) {
  const { t } = useTranslation()
  const lockedPlatform = useAuthStore((s) => scopedPlatform(s.platformScope))

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{t('nav.devices')}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {lockedPlatform ? (
            // With one ecosystem reachable the picker would be a single-entry
            // submenu, so link straight to that list instead.
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={nav.isDevices}
                render={
                  <Link
                    to="/devices"
                    search={{ platform: lockedPlatform }}
                    activeOptions={{ exact: false, includeSearch: true }}
                  />
                }
              >
                {lockedPlatform === 'windows' ? <WindowsIcon /> : <AndroidIcon />}
                <span>{t('nav.devices')}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ) : (
            <Collapsible defaultOpen={nav.isDevices} className="group/collapsible">
              <SidebarMenuItem>
                <CollapsibleTrigger
                  render={
                    <SidebarMenuButton isActive={nav.isDevices} tooltip={t('nav.devices')} />
                  }
                >
                  <Smartphone />
                  <span>{t('nav.devices')}</span>
                  <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton
                        isActive={nav.isDevicesAndroid}
                        render={
                          <Link
                            to="/devices"
                            search={{ platform: 'android' }}
                            activeOptions={{ exact: false, includeSearch: true }}
                          />
                        }
                      >
                        <AndroidIcon />
                        <span>{t('nav.devicesAndroid')}</span>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton
                        isActive={nav.isDevicesWindows}
                        render={
                          <Link
                            to="/devices"
                            search={{ platform: 'windows' }}
                            activeOptions={{ exact: false, includeSearch: true }}
                          />
                        }
                      >
                        <WindowsIcon />
                        <span>{t('nav.devicesWindows')}</span>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          )}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

function AndroidManagementGroup({ nav }: { nav: NavState }) {
  const { t } = useTranslation()

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{t('nav.androidManagement')}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={nav.isConfigurations}
              render={<Link to="/configurations" />}
            >
              <SlidersHorizontal />
              <span>{t('nav.configurations')}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={nav.isApplications}
              render={<Link to="/applications" />}
            >
              <Package />
              <span>{t('nav.applications')}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton isActive={nav.isFiles} render={<Link to="/files" />}>
              <FolderOpen />
              <span>{t('nav.files')}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton isActive={nav.isGroups} render={<Link to="/groups" />}>
              <UsersRound />
              <span>{t('nav.groups')}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <Collapsible defaultOpen={nav.isPlugins} className="group/collapsible">
            <SidebarMenuItem>
              <CollapsibleTrigger
                render={
                  <SidebarMenuButton isActive={nav.isPlugins} tooltip={t('nav.plugins')} />
                }
              >
                <Monitor />
                <span>{t('nav.plugins')}</span>
                <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenuSub>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton
                      isActive={nav.isRemoteControl}
                      render={<Link to="/plugins/remote-control" />}
                    >
                      <Terminal />
                      <span>{t('nav.remoteControl')}</span>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton
                      isActive={nav.isPush}
                      render={<Link to="/plugins/push" />}
                    >
                      <Radio />
                      <span>{t('nav.push')}</span>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton
                      isActive={nav.isMessaging}
                      render={<Link to="/plugins/messaging" />}
                    >
                      <MessageSquare />
                      <span>{t('nav.messaging')}</span>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                </SidebarMenuSub>
              </CollapsibleContent>
            </SidebarMenuItem>
          </Collapsible>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

function WindowsManagementGroup({ nav }: { nav: NavState }) {
  const { t } = useTranslation()

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{t('nav.windowsManagement')}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={nav.isWindowsConfigurations}
              render={<Link to="/windows/configurations" />}
            >
              <Settings2 />
              <span>{t('nav.windowsConfigurations')}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={nav.isWindowsEnrollment}
              render={<Link to="/windows/enrollment" />}
            >
              <MonitorSmartphone />
              <span>{t('nav.windowsEnrollment')}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={nav.isWindowsScripts}
              render={<Link to="/windows/scripts" />}
            >
              <Terminal />
              <span>{t('nav.windowsScripts')}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={nav.isWindowsApplications}
              render={<Link to="/windows/applications" />}
            >
              <Package />
              <span>{t('nav.windowsApplications')}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={nav.isWindowsFiles}
              render={<Link to="/windows/files" />}
            >
              <FolderOpen />
              <span>{t('nav.windowsFiles')}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

export function AppSidebar() {
  const { t } = useTranslation()
  const nav = useNavState()

  // A role scoped to one ecosystem must not see the other one's navigation.
  // Go enforces the same rule on the Windows routes; the Java-served Android
  // routes do not check scope yet, so for those this is the only thing keeping
  // an operator out of screens they should not use.
  const platformScope = useAuthStore((s) => s.platformScope)
  const showAndroid = scopeAllowsPlatform(platformScope, 'android')
  const showWindows = scopeAllowsPlatform(platformScope, 'windows')

  return (
    <SidebarContent className="gap-0 p-0">
      <SidebarGroup>
        <SidebarGroupLabel>{t('nav.general')}</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton isActive={nav.isDashboard} render={<Link to="/dashboard" />}>
                <LayoutDashboard />
                <span>{t('nav.dashboard')}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      <SidebarSeparator />

      <DevicesGroup nav={nav} />

      {/* Each optional group carries its own leading separator so hiding it
          does not leave a dangling divider. */}
      {showAndroid && (
        <>
          <SidebarSeparator />
          <AndroidManagementGroup nav={nav} />
        </>
      )}

      {showWindows && (
        <>
          <SidebarSeparator />
          <WindowsManagementGroup nav={nav} />
        </>
      )}

      <SidebarSeparator />

      <SidebarGroup>
        <SidebarGroupLabel>{t('nav.administration')}</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton isActive={nav.isUsers} render={<Link to="/users" />}>
                <Users />
                <span>{t('nav.users')}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton isActive={nav.isRoles} render={<Link to="/roles" />}>
                <Shield />
                <span>{t('nav.roles')}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton isActive={nav.isSettings} render={<Link to="/settings" />}>
                <Settings />
                <span>{t('nav.settings')}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarContent>
  )
}
