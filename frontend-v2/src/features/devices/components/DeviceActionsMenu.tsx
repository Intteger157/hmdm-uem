import { MoreHorizontal } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Menu as MenuPrimitive } from '@base-ui/react/menu'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import type { DeviceView } from '@/shared/api/types/device'
import { usePermissions } from '@/features/auth/hooks/use-permissions'
import type { AccessLevel } from '@/shared/lib/access-level'

export type DeviceActionsMenuAction =
  | 'appSettings'
  | 'details'
  | 'logs'
  | 'messaging'
  | 'push'
  | 'reset'
  | 'installedApps'
  | 'location'
  | 'remoteControl'

interface DeviceActionsMenuProps {
  device: DeviceView
  onAction: (action: DeviceActionsMenuAction, device: DeviceView) => void
}

/**
 * Least access level allowed to open each entry, defaulting to the Operator
 * level. Kept in step with ANDROID_ACTIONS in DeviceActionsPanel, which offers
 * the same set of dialogs from the device detail page.
 */
const MENU_ITEMS: { action: DeviceActionsMenuAction; minLevel: AccessLevel }[] = [
  { action: 'appSettings', minLevel: 'mid' },
  { action: 'details', minLevel: 'low' },
  { action: 'logs', minLevel: 'low' },
  { action: 'messaging', minLevel: 'mid' },
  { action: 'push', minLevel: 'mid' },
  { action: 'reset', minLevel: 'mid' },
  { action: 'installedApps', minLevel: 'low' },
  { action: 'location', minLevel: 'low' },
  { action: 'remoteControl', minLevel: 'high' },
]

function DeviceActionsDropdownContent({
  className,
  ...props
}: MenuPrimitive.Popup.Props) {
  return (
    <DropdownMenuPortal>
      <MenuPrimitive.Positioner
        align="end"
        side="bottom"
        sideOffset={4}
        className="isolate z-50 outline-none"
      >
        <MenuPrimitive.Popup
          data-slot="dropdown-menu-content"
          className={cn(
            'z-50 max-h-(--available-height) min-w-52 origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 outline-none data-[side=bottom]:slide-in-from-top-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:overflow-hidden data-closed:fade-out-0 data-closed:zoom-out-95',
            className,
          )}
          {...props}
        />
      </MenuPrimitive.Positioner>
    </DropdownMenuPortal>
  )
}

export function DeviceActionsMenu({ device, onAction }: DeviceActionsMenuProps) {
  const { t } = useTranslation()
  const { atLeast } = usePermissions()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            title={t('devices.actions.more')}
          />
        }
      >
        <MoreHorizontal className="size-3.5" />
      </DropdownMenuTrigger>
      <DeviceActionsDropdownContent>
        {MENU_ITEMS.filter(({ minLevel }) => atLeast(minLevel)).map(({ action }) => (
          <DropdownMenuItem key={action} onClick={() => onAction(action, device)}>
            {t(`devices.actionsMenu.${action}`)}
          </DropdownMenuItem>
        ))}
      </DeviceActionsDropdownContent>
    </DropdownMenu>
  )
}
