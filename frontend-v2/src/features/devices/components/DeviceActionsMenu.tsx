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

const MENU_ITEMS: DeviceActionsMenuAction[] = [
  'appSettings',
  'details',
  'logs',
  'messaging',
  'push',
  'reset',
  'installedApps',
  'location',
  'remoteControl',
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
        {MENU_ITEMS.map((action) => (
          <DropdownMenuItem key={action} onClick={() => onAction(action, device)}>
            {t(`devices.actionsMenu.${action}`)}
          </DropdownMenuItem>
        ))}
      </DeviceActionsDropdownContent>
    </DropdownMenu>
  )
}
