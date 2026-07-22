import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { buildDeviceRemoteViewerUrl } from '@/features/plugins/deviceremote/api/deviceremote-api'
import {
  useDeviceRemoteSettingsQuery,
  useDeviceRemoteStatusQuery,
  useStartDeviceRemoteMutation,
  useStopDeviceRemoteMutation,
} from '@/features/plugins/deviceremote/hooks/use-deviceremote'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface DeviceRemoteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  deviceId?: number
  deviceLabel?: string
}

export function DeviceRemoteDialog({
  open,
  onOpenChange,
  deviceId,
  deviceLabel,
}: DeviceRemoteDialogProps) {
  const { t } = useTranslation()
  const settingsQuery = useDeviceRemoteSettingsQuery()
  const statusQuery = useDeviceRemoteStatusQuery(deviceId, open)
  const startMutation = useStartDeviceRemoteMutation()
  const stopMutation = useStopDeviceRemoteMutation()
  const [polling, setPolling] = useState(false)

  useEffect(() => {
    setPolling(open)
  }, [open])

  const status = statusQuery.data
  const viewerUrl = useMemo(
    () => (status ? buildDeviceRemoteViewerUrl(status, settingsQuery.data?.serverUrl) : null),
    [status, settingsQuery.data?.serverUrl]
  )

  const agent = (status?.agentStatus ?? '').trim().toLowerCase()
  const canOpenViewer = (agent === 'ready' || agent === 'sharing') && Boolean(viewerUrl)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('plugins.deviceremote.title')}</DialogTitle>
          <DialogDescription>
            {t('plugins.deviceremote.description', { device: deviceLabel ?? '' })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <p>
            <span className="text-muted-foreground">{t('plugins.deviceremote.status')}:</span>{' '}
            {status?.status ?? '—'}
          </p>
          <p>
            <span className="text-muted-foreground">{t('plugins.deviceremote.agentStatus')}:</span>{' '}
            {status?.agentStatus ?? '—'}
          </p>
          {polling && statusQuery.isFetching && (
            <p className="text-muted-foreground">{t('plugins.deviceremote.polling')}</p>
          )}
        </div>

        <DialogFooter className="flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={!deviceId || startMutation.isPending}
            onClick={() => deviceId && void startMutation.mutate(deviceId)}
          >
            {t('plugins.deviceremote.start')}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!deviceId || stopMutation.isPending}
            onClick={() => deviceId && void stopMutation.mutate(deviceId)}
          >
            {t('plugins.deviceremote.stop')}
          </Button>
          {canOpenViewer && viewerUrl && (
            <Button type="button" render={<a href={viewerUrl} target="_blank" rel="noreferrer" />}>
              {t('plugins.deviceremote.openViewer')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
