import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { fetchDeviceDetailedInfo } from '@/features/devices/api/device-plugins-api'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  formatDeviceInfoGroups,
  formatDeviceInfoScalar,
  formatDeviceInfoTimestamp,
  getDeviceInfoMainFields,
  parseDeviceInfoApplications,
  type DeviceInfoDetailsView,
} from '@/features/devices/utils/device-info-formatters'
import { cn } from '@/lib/utils'

interface DeviceInfoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  deviceNumber?: string
}

function formatBoolean(value: unknown, t: (key: string) => string): string {
  if (typeof value !== 'boolean') {
    return formatDeviceInfoScalar(value)
  }
  return value ? t('common.yes') : t('common.no')
}

function DeviceInfoValueCell({
  field,
  value,
  data,
  t,
}: {
  field: string
  value: unknown
  data: DeviceInfoDetailsView
  t: (key: string) => string
}) {
  if (field === 'latestUpdateTime') {
    return (
      <span>
        {formatDeviceInfoTimestamp(
          typeof value === 'number' ? value : undefined,
          typeof data.latestUpdateInterval === 'number' ? data.latestUpdateInterval : undefined,
          typeof data.latestUpdateIntervalType === 'string' ? data.latestUpdateIntervalType : undefined,
        )}
      </span>
    )
  }

  if (field === 'groups') {
    const groups = formatDeviceInfoGroups(value)
    if (groups.length === 0) {
      return <span>—</span>
    }
    return (
      <div className="space-y-1">
        {groups.map((group) => (
          <div key={group}>{group}</div>
        ))}
      </div>
    )
  }

  if (field === 'batteryLevel' && typeof value === 'number') {
    return <span className={cn(value <= 20 && 'font-medium text-red-600')}>{value}%</span>
  }

  if (
    field === 'adminPermission' ||
    field === 'overlapPermission' ||
    field === 'historyPermission' ||
    field === 'accessibilityPermission' ||
    field === 'mdmMode' ||
    field === 'kioskMode' ||
    field === 'defaultLauncher'
  ) {
    return <span>{formatBoolean(value, t)}</span>
  }

  return <span>{formatDeviceInfoScalar(value)}</span>
}

export function DeviceInfoDialog({ open, onOpenChange, deviceNumber }: DeviceInfoDialogProps) {
  const { t } = useTranslation()

  const infoQuery = useQuery({
    queryKey: ['device-detailed-info', deviceNumber],
    queryFn: () => fetchDeviceDetailedInfo(deviceNumber!) as Promise<DeviceInfoDetailsView>,
    enabled: open && Boolean(deviceNumber),
  })

  const data = infoQuery.data ?? {}
  const mainFields = getDeviceInfoMainFields(data)
  const applications = parseDeviceInfoApplications(data.applications)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-3xl flex-col overflow-hidden sm:max-w-3xl">
        <DialogHeader className="shrink-0">
          <DialogTitle>{t('devices.actionsMenu.details')}</DialogTitle>
          <DialogDescription>
            {t('devices.info.subtitle', { device: deviceNumber ?? '—' })}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          <div className="overflow-hidden rounded-md border">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-muted/80">
                <tr className="text-muted-foreground">
                  <th className="w-[38%] px-3 py-2 font-medium">{t('devices.info.columns.field')}</th>
                  <th className="px-3 py-2 font-medium">{t('devices.info.columns.value')}</th>
                </tr>
              </thead>
              <tbody>
                {mainFields.map(([key, value]) => (
                  <tr key={key} className="border-b last:border-b-0 align-top">
                    <td className="px-3 py-2 font-medium">{t(`devices.info.fields.${key}`, key)}</td>
                    <td className="px-3 py-2 text-sm">
                      <DeviceInfoValueCell field={key} value={value} data={data} t={t} />
                    </td>
                  </tr>
                ))}
                {!infoQuery.isLoading && mainFields.length === 0 && (
                  <tr>
                    <td colSpan={2} className="px-3 py-8 text-center text-muted-foreground">
                      {t('devices.info.empty')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {applications.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium">{t('devices.info.applicationsTitle')}</h3>
              <div className="overflow-hidden rounded-md border">
                <table className="w-full text-left text-sm">
                  <thead className="border-b bg-muted/80 text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">{t('devices.info.applications.name')}</th>
                      <th className="px-3 py-2 font-medium">{t('devices.info.applications.pkg')}</th>
                      <th className="px-3 py-2 font-medium">{t('devices.info.applications.installed')}</th>
                      <th className="px-3 py-2 font-medium">{t('devices.info.applications.required')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {applications.map((app) => {
                      const versionMismatch =
                        app.versionValid === false ||
                        (app.versionInstalled &&
                          app.versionRequired &&
                          app.versionRequired !== '0' &&
                          app.versionInstalled !== app.versionRequired)

                      return (
                        <tr key={`${app.applicationPkg}-${app.applicationName}`} className="border-b last:border-b-0">
                          <td className="px-3 py-2">{app.applicationName ?? '—'}</td>
                          <td className="px-3 py-2 font-mono text-xs">{app.applicationPkg ?? '—'}</td>
                          <td className={cn('px-3 py-2', versionMismatch && 'text-amber-700')}>
                            {app.versionInstalled ?? '—'}
                          </td>
                          <td className="px-3 py-2">{app.versionRequired ?? '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
