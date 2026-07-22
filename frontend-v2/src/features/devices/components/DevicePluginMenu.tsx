import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, MessageSquare, Monitor, Radio } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface DevicePluginMenuItem {
  id: string
  label: string
  icon: typeof Monitor
  onSelect: () => void
}

interface DevicePluginMenuProps {
  items: DevicePluginMenuItem[]
}

export function DevicePluginMenu({ items }: DevicePluginMenuProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) {
      return undefined
    }

    const handleClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  if (items.length === 0) {
    return null
  }

  return (
    <div ref={rootRef} className="relative">
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        title={t('devices.actions.more')}
        onClick={() => setOpen((value) => !value)}
      >
        <ChevronDown className="size-3.5" />
      </Button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 min-w-44 rounded-md border bg-popover py-1 text-popover-foreground shadow-md">
          {items.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                onClick={() => {
                  item.onSelect()
                  setOpen(false)
                }}
              >
                <Icon className="size-3.5 shrink-0" />
                {item.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export const DEVICE_PLUGIN_ICONS = {
  remote: Monitor,
  messaging: MessageSquare,
  push: Radio,
} as const
