import { Link, useRouterState } from '@tanstack/react-router'
import {
  ChevronRight,
  FolderOpen,
  LayoutDashboard,
  MessageSquare,
  Monitor,
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
    isWindowsScripts: pathname.startsWith('/windows/scripts'),
    isWindowsApplications: pathname.startsWith('/windows/applications'),
  }
}

export function AppSidebar() {
  const { t } = useTranslation()
  const nav = useNavState()

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

      <SidebarGroup>
        <SidebarGroupLabel>{t('nav.devices')}</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
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
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      <SidebarSeparator />

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

      <SidebarSeparator />

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
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

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
