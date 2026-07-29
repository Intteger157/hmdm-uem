import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useDeviceDetailCommandToast } from '@/features/devices/context/device-detail-command-toast-context'
import { queueWindowsDeviceCommand } from '@/features/windows/api/windows-api'
import type { InstalledSoftware } from '@/shared/api/types/device-detail'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { OVERVIEW_FLAT_CARD_CLASS } from '@/features/devices/components/overview-card-styles'
import { cn } from '@/lib/utils'

interface WindowsDeviceInstalledSoftwareTabProps {
  hardwareId: string
  software: InstalledSoftware[]
}

export function WindowsDeviceInstalledSoftwareTab({
  hardwareId,
  software,
}: WindowsDeviceInstalledSoftwareTabProps) {
  const { t } = useTranslation()
  const { trackActionLogCommand } = useDeviceDetailCommandToast()
  const [pendingApp, setPendingApp] = useState<InstalledSoftware | null>(null)
  const [isQueueing, setIsQueueing] = useState(false)

  const handleConfirmUninstall = async () => {
    if (!pendingApp) {
      return
    }

    const uninstallString = pendingApp.uninstallString?.trim() ?? ''
    if (!uninstallString) {
      toast.error(t('deviceDetail.software.uninstallUnavailable'))
      return
    }

    try {
      setIsQueueing(true)
      const response = await queueWindowsDeviceCommand(hardwareId, 'UninstallApp', JSON.stringify({
        appName: pendingApp.name,
        uninstallString,
      }))
      trackActionLogCommand(hardwareId, response.id)
      setPendingApp(null)
    } catch {
      toast.error(t('deviceDetail.software.uninstallFailed'))
    } finally {
      setIsQueueing(false)
    }
  }

  return (
    <>
      <Card className={cn('w-full overflow-visible', OVERVIEW_FLAT_CARD_CLASS)}>
        <CardContent className="p-0">
          <table className="w-full min-w-full text-left text-sm">
            <thead className="sticky top-0 z-10 border-b bg-muted/80 backdrop-blur">
                <tr className="text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">{t('deviceDetail.software.name')}</th>
                  <th className="px-4 py-2.5 font-medium">{t('deviceDetail.software.version')}</th>
                  <th className="px-4 py-2.5 font-medium">{t('deviceDetail.software.publisher')}</th>
                  <th className="px-4 py-2.5 font-medium">{t('deviceDetail.software.installed')}</th>
                  <th className="px-4 py-2.5 font-medium">{t('deviceDetail.software.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {software.map((app) => {
                  const canUninstall = Boolean(app.uninstallString?.trim())
                  return (
                    <tr key={`${app.name}-${app.version}-${app.publisher}`} className="border-b last:border-0">
                      <td className="px-4 py-2.5 font-medium">{app.name}</td>
                      <td className="px-4 py-2.5 font-mono text-xs">{app.version}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{app.publisher}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap">{app.installDate}</td>
                      <td className="px-4 py-2.5">
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          disabled={!canUninstall || isQueueing}
                          title={
                            canUninstall
                              ? t('deviceDetail.software.uninstall')
                              : t('deviceDetail.software.uninstallUnavailable')
                          }
                          className={cn(
                            'text-muted-foreground hover:text-destructive',
                            !canUninstall && 'opacity-40',
                          )}
                          onClick={() => setPendingApp(app)}
                        >
                          <Trash2 className="size-4" />
                          <span className="sr-only">{t('deviceDetail.software.uninstall')}</span>
                        </Button>
                      </td>
                    </tr>
                  )
                })}
                {software.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      {t('deviceDetail.software.empty')}
                    </td>
                  </tr>
                ) : null}
              </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={pendingApp != null} onOpenChange={(open) => !open && setPendingApp(null)}>
        <DialogContent className="sm:max-w-md" showCloseButton={!isQueueing}>
          <DialogHeader>
            <DialogTitle>{t('deviceDetail.software.uninstallConfirmTitle')}</DialogTitle>
            <DialogDescription>
              {t('deviceDetail.software.uninstallConfirmDescription', { appName: pendingApp?.name ?? '' })}
            </DialogDescription>
          </DialogHeader>
          {pendingApp?.uninstallString ? (
            <p className="rounded-md bg-muted px-3 py-2 font-mono text-xs break-all text-muted-foreground">
              {pendingApp.uninstallString}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isQueueing}
              onClick={() => setPendingApp(null)}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isQueueing}
              onClick={() => void handleConfirmUninstall()}
            >
              {t('deviceDetail.software.uninstallConfirmAction')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
