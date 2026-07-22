import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import {
  fetchDeviceInventory,
  requestDeviceInventoryScan,
} from '@/features/devices/api/device-plugins-api'
import {
  appsFromDeviceInfo,
  filterInstalledApps,
  hasInventoryHelperInstalled,
  installedAppDisplayName,
} from '@/features/devices/utils/installed-apps-utils'
import type { DeviceView } from '@/shared/api/types/device'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

interface DeviceInstalledAppsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  device?: DeviceView | null
}

const SCAN_POLL_INTERVAL_MS = 5000
const SCAN_POLL_DURATION_MS = 120000

function formatScanTime(value?: number): string {
  if (!value) {
    return '—'
  }
  return new Date(value).toLocaleString()
}

export function DeviceInstalledAppsDialog({
  open,
  onOpenChange,
  device,
}: DeviceInstalledAppsDialogProps) {
  const { t } = useTranslation()
  const deviceNumber = device?.number
  const [filterText, setFilterText] = useState('')
  const [awaitingScan, setAwaitingScan] = useState(false)
  const pollStartedAtRef = useRef<number | null>(null)

  useEffect(() => {
    if (open) {
      setFilterText('')
      setAwaitingScan(false)
      pollStartedAtRef.current = null
    }
  }, [open, deviceNumber])

  const inventoryQuery = useQuery({
    queryKey: ['device-inventory', deviceNumber],
    queryFn: () => fetchDeviceInventory(deviceNumber!),
    enabled: open && Boolean(deviceNumber),
    retry: false,
    staleTime: 0,
    refetchOnMount: 'always',
  })

  const scanMutation = useMutation({
    mutationFn: () => requestDeviceInventoryScan(deviceNumber!),
    onSuccess: () => {
      toast.success(t('devices.installedApps.scanRequested'))
      setAwaitingScan(true)
      pollStartedAtRef.current = Date.now()
      void inventoryQuery.refetch()
    },
    onError: () => toast.error(t('devices.installedApps.error')),
  })

  const inventoryApps = inventoryQuery.data?.applications ?? []
  const syncApps = useMemo(
    () => appsFromDeviceInfo(device?.info?.applications),
    [device?.info?.applications],
  )
  const inventoryHelperInstalled = hasInventoryHelperInstalled(device?.info?.applications)
  const apps = useMemo(
    () => filterInstalledApps(inventoryApps, filterText),
    [inventoryApps, filterText],
  )
  const partialApps = useMemo(() => {
    if (inventoryApps.length > 0) {
      return []
    }

    return filterInstalledApps(
      syncApps.filter((app) => app.pkg !== 'com.hmdm.inventory'),
      filterText,
    )
  }, [inventoryApps.length, syncApps, filterText])

  const hasInventoryScan =
    inventoryQuery.data?.lastUpdate != null && inventoryQuery.data.lastUpdate > 0
  const showPartialLauncherApps = !hasInventoryScan && partialApps.length > 0

  useEffect(() => {
    if (!open || !awaitingScan || hasInventoryScan) {
      if (hasInventoryScan) {
        setAwaitingScan(false)
      }
      return
    }

    const startedAt = pollStartedAtRef.current ?? Date.now()
    pollStartedAtRef.current = startedAt

    const interval = window.setInterval(() => {
      if (Date.now() - startedAt >= SCAN_POLL_DURATION_MS) {
        setAwaitingScan(false)
        return
      }

      void inventoryQuery.refetch()
    }, SCAN_POLL_INTERVAL_MS)

    return () => window.clearInterval(interval)
  }, [awaitingScan, hasInventoryScan, inventoryQuery, open])

  const hintKey = hasInventoryScan
    ? null
    : inventoryHelperInstalled
      ? awaitingScan
        ? 'devices.installedApps.waitingForScan'
        : 'devices.installedApps.helperInstalledHint'
      : 'devices.installedApps.inventoryHint'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(90vh,900px)] w-full max-w-5xl flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <DialogHeader className="shrink-0 space-y-1 border-b px-6 py-4">
          <DialogTitle>{t('devices.actionsMenu.installedApps')}</DialogTitle>
          <DialogDescription>
            {t('devices.installedApps.subtitle', {
              device: deviceNumber ?? '—',
              updated: formatScanTime(inventoryQuery.data?.lastUpdate),
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="flex shrink-0 flex-col gap-3 border-b px-6 py-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1 text-sm">
            <p className="font-medium">{t('devices.installedApps.lastScan')}</p>
            <p className="text-muted-foreground">
              {hasInventoryScan
                ? formatScanTime(inventoryQuery.data?.lastUpdate)
                : t('devices.installedApps.noScanYet')}
            </p>
            {!inventoryQuery.isLoading && !inventoryQuery.error ? (
              <p className="text-xs text-muted-foreground">
                {t('devices.installedApps.appCount', {
                  shown: apps.length,
                  total: inventoryApps.length,
                })}
              </p>
            ) : null}
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[320px]">
            <Input
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder={t('devices.installedApps.searchPlaceholder')}
            />
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                disabled={inventoryQuery.isFetching || !deviceNumber}
                onClick={() => void inventoryQuery.refetch()}
              >
                <RefreshCw className="mr-1 size-4" />
                {t('devices.installedApps.refresh')}
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                disabled={scanMutation.isPending || !deviceNumber}
                onClick={() => void scanMutation.mutate()}
              >
                {t('devices.installedApps.requestScan')}
              </Button>
            </div>
          </div>
        </div>

        {inventoryQuery.isLoading ? (
          <p className="px-6 py-8 text-sm text-muted-foreground">{t('common.loading')}</p>
        ) : inventoryQuery.error ? (
          <div className="space-y-2 px-6 py-6">
            <div className="rounded-lg border border-destructive/40 p-4">
              <p className="text-sm text-destructive">{t('devices.installedApps.loadError')}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => void inventoryQuery.refetch()}
              >
                {t('common.retry')}
              </Button>
            </div>
          </div>
        ) : (
          <>
            {hintKey ? (
              <p
                className={
                  awaitingScan
                    ? 'shrink-0 px-6 pt-4 text-sm text-amber-700 dark:text-amber-300'
                    : 'shrink-0 px-6 pt-4 text-sm text-muted-foreground'
                }
              >
                {t(hintKey)}
              </p>
            ) : null}

            <div className="min-h-0 flex-1 overflow-auto px-6 py-4">
              {apps.length > 0 ? (
                <InstalledAppsTable apps={apps} t={t} />
              ) : showPartialLauncherApps ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    {t('devices.installedApps.partialLauncherSection')}
                  </p>
                  <InstalledAppsTable apps={partialApps} t={t} />
                </div>
              ) : (
                <InstalledAppsTable apps={apps} t={t} emptyMessage={t('devices.installedApps.empty')} />
              )}
            </div>

            {!hasInventoryScan ? (
              <p className="shrink-0 border-t px-6 py-3 text-xs text-muted-foreground">
                {inventoryHelperInstalled
                  ? t('devices.installedApps.helperInstalledFooter')
                  : t('devices.installedApps.inventoryFooterHint')}
              </p>
            ) : null}
          </>
        )}

        <DialogFooter className="shrink-0 border-t px-6 py-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function InstalledAppsTable({
  apps,
  t,
  emptyMessage,
}: {
  apps: ReturnType<typeof filterInstalledApps>
  t: (key: string) => string
  emptyMessage?: string
}) {
  return (
    <table className="w-full min-w-[760px] text-left text-sm">
      <thead className="sticky top-0 z-10 border-b bg-background">
        <tr className="text-muted-foreground">
          <th className="px-3 py-2 font-medium">{t('devices.installedApps.columns.name')}</th>
          <th className="px-3 py-2 font-medium">{t('devices.installedApps.columns.pkg')}</th>
          <th className="px-3 py-2 font-medium">{t('devices.installedApps.columns.version')}</th>
          <th className="w-24 px-3 py-2 font-medium">{t('devices.installedApps.columns.system')}</th>
        </tr>
      </thead>
      <tbody>
        {apps.map((app) => (
          <tr key={`${app.pkg}-${app.version ?? ''}`} className="border-b last:border-0">
            <td className="px-3 py-2">{installedAppDisplayName(app)}</td>
            <td className="px-3 py-2 font-mono text-xs">{app.pkg ?? '—'}</td>
            <td className="px-3 py-2">{app.version ?? '—'}</td>
            <td className="px-3 py-2 text-center text-muted-foreground">{app.system ? '✓' : ''}</td>
          </tr>
        ))}
        {apps.length === 0 && emptyMessage ? (
          <tr>
            <td colSpan={4} className="px-3 py-12 text-center text-muted-foreground">
              {emptyMessage}
            </td>
          </tr>
        ) : null}
      </tbody>
    </table>
  )
}
