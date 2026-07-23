import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  useAssignDeviceAppMutation,
  useSoftwareAppsQuery,
} from '@/features/windows/applications/hooks/use-windows-software-apps'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import type { DeviceAppStatusItem } from '@/features/windows/applications/types/software-app'

interface DeployApplicationDialogProps {
  hardwareId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  deviceAppStatuses?: DeviceAppStatusItem[]
}

export function DeployApplicationDialog({
  hardwareId,
  open,
  onOpenChange,
  deviceAppStatuses = [],
}: DeployApplicationDialogProps) {
  const { t } = useTranslation()
  const softwareAppsQuery = useSoftwareAppsQuery(open)
  const assignMutation = useAssignDeviceAppMutation()
  const [selectedAppId, setSelectedAppId] = useState('')

  const statusByAppId = useMemo(() => {
    const map = new Map<number, DeviceAppStatusItem['status']>()
    for (const item of deviceAppStatuses) {
      map.set(item.appId, item.status)
    }
    return map
  }, [deviceAppStatuses])

  const catalogApps = softwareAppsQuery.data ?? []

  const formatAppLabel = (app: (typeof catalogApps)[number]) => {
    const base = app.version ? `${app.name} (${app.version})` : app.name
    const status = statusByAppId.get(app.id)
    if (!status) {
      return base
    }
    return `${base} — ${status}`
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setSelectedAppId('')
    }
    onOpenChange(nextOpen)
  }

  const handleDeploy = async () => {
    const appId = Number.parseInt(selectedAppId, 10)
    if (!Number.isFinite(appId) || appId <= 0) {
      return
    }

    try {
      await assignMutation.mutateAsync({ hardwareId, appId })
      toast.success(t('deviceDetail.appDeployments.deploySuccess'))
      handleOpenChange(false)
    } catch {
      toast.error(t('deviceDetail.appDeployments.deployError'))
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('deviceDetail.actions.install')}</DialogTitle>
          <DialogDescription>{t('deviceDetail.actions.installDescription')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="deploy-app-select">{t('deviceDetail.appDeployments.deployAppLabel')}</Label>
          <select
            id="deploy-app-select"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            value={selectedAppId}
            disabled={softwareAppsQuery.isLoading || assignMutation.isPending}
            onChange={(event) => setSelectedAppId(event.target.value)}
          >
            <option value="">{t('deviceDetail.appDeployments.deployAppPlaceholder')}</option>
            {catalogApps.map((app) => (
              <option key={app.id} value={String(app.id)}>
                {formatAppLabel(app)}
              </option>
            ))}
          </select>
          {softwareAppsQuery.isError ? (
            <p className="text-xs text-destructive">{t('deviceDetail.appDeployments.deployLoadError')}</p>
          ) : null}
          {!softwareAppsQuery.isLoading && !softwareAppsQuery.isError && catalogApps.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t('deviceDetail.appDeployments.deployCatalogEmpty')}</p>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={assignMutation.isPending}>
            {t('common.cancel')}
          </Button>
          <Button type="button" onClick={() => void handleDeploy()} disabled={!selectedAppId || assignMutation.isPending}>
            {t('deviceDetail.appDeployments.deployConfirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
