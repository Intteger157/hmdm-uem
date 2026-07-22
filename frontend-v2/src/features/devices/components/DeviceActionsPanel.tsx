import { useState } from 'react'
import {
  Activity,
  Download,
  LayoutGrid,
  Lock,
  MessageSquare,
  Pencil,
  RefreshCw,
  RotateCcw,
  Shield,
  Terminal,
  Trash2,
  Usb,
} from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

const PRIMARY_ACTIONS = [
  { id: 'sync', icon: RefreshCw, labelKey: 'deviceDetail.actions.sync', variant: 'outline' as const },
  { id: 'restart', icon: RotateCcw, labelKey: 'deviceDetail.actions.restart', variant: 'outline' as const },
  { id: 'lock', icon: Lock, labelKey: 'deviceDetail.actions.lock', variant: 'outline' as const },
  { id: 'bitlocker', icon: Shield, labelKey: 'deviceDetail.actions.bitlocker', variant: 'outline' as const },
  { id: 'install', icon: Download, labelKey: 'deviceDetail.actions.install', variant: 'outline' as const },
  { id: 'powershell', icon: Terminal, labelKey: 'deviceDetail.actions.powershell', variant: 'outline' as const },
  { id: 'wipe', icon: Trash2, labelKey: 'deviceDetail.actions.wipe', variant: 'destructive' as const },
]

const EXTENDED_ACTIONS = [
  { id: 'diagnostics', icon: Activity, labelKey: 'deviceDetail.actions.diagnostics' },
  { id: 'rename', icon: Pencil, labelKey: 'deviceDetail.actions.rename' },
  { id: 'message', icon: MessageSquare, labelKey: 'deviceDetail.actions.message' },
  { id: 'usb', icon: Usb, labelKey: 'deviceDetail.actions.usb' },
  { id: 'windowsUpdate', icon: Download, labelKey: 'deviceDetail.actions.windowsUpdate' },
]

export function DeviceActionsPanel() {
  const { t } = useTranslation()
  const [allActionsOpen, setAllActionsOpen] = useState(false)

  const handleAction = (_actionId: string, label: string) => {
    toast.info(t('deviceDetail.actions.toast', { action: label }))
  }

  const handleExtendedAction = (actionId: string, label: string) => {
    handleAction(actionId, label)
    setAllActionsOpen(false)
  }

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {PRIMARY_ACTIONS.map(({ id, icon: Icon, labelKey, variant }) => {
          const label = t(labelKey)
          return (
            <Card
              key={id}
              className="cursor-pointer transition-colors hover:bg-muted/30"
              onClick={() => handleAction(id, label)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <div className="flex size-8 items-center justify-center rounded-md bg-muted">
                    <Icon className="size-4" />
                  </div>
                  <CardTitle className="text-sm font-medium">{label}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <CardDescription className="text-xs">
                  {t('deviceDetail.actions.mockHint')}
                </CardDescription>
                <Button
                  type="button"
                  size="sm"
                  variant={variant}
                  className="mt-3 w-full"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleAction(id, label)
                  }}
                >
                  {t('deviceDetail.actions.run')}
                </Button>
              </CardContent>
            </Card>
          )
        })}

        <Card className="border-dashed bg-muted/20 transition-colors hover:bg-muted/40">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-md border border-dashed bg-background">
                <LayoutGrid className="size-4 text-muted-foreground" />
              </div>
              <CardTitle className="text-sm font-medium">
                {t('deviceDetail.actions.allActions')}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <CardDescription className="text-xs">
              {t('deviceDetail.actions.allActionsHint')}
            </CardDescription>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="mt-3 w-full"
              onClick={() => setAllActionsOpen(true)}
            >
              {t('deviceDetail.actions.browseAll')}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Sheet open={allActionsOpen} onOpenChange={setAllActionsOpen}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
          <SheetHeader className="border-b px-4 py-4">
            <SheetTitle>{t('deviceDetail.actions.allActions')}</SheetTitle>
            <SheetDescription>{t('deviceDetail.actions.allActionsDescription')}</SheetDescription>
          </SheetHeader>
          <Command className="flex-1 rounded-none border-0">
            <CommandInput placeholder={t('deviceDetail.actions.searchPlaceholder')} />
            <CommandList className="max-h-none flex-1">
              <CommandEmpty>{t('deviceDetail.actions.searchEmpty')}</CommandEmpty>
              <CommandGroup heading={t('deviceDetail.actions.extendedGroup')}>
                {EXTENDED_ACTIONS.map(({ id, icon: Icon, labelKey }) => {
                  const label = t(labelKey)
                  return (
                    <CommandItem
                      key={id}
                      value={label}
                      onSelect={() => handleExtendedAction(id, label)}
                    >
                      <Icon />
                      <span>{label}</span>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </SheetContent>
      </Sheet>
    </>
  )
}
