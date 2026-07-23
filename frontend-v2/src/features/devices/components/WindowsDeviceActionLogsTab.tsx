import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, Eye } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useWindowsDeviceCommandLogsQuery } from '@/features/windows/hooks/use-windows-device-command-logs-query'
import type { DeviceCommandLogEntry } from '@/features/windows/api/windows-api'
import { formatDeviceTimestamp } from '@/features/devices/utils/device-detail-formatters'
import { cn } from '@/lib/utils'

interface WindowsDeviceActionLogsTabProps {
  hardwareId: string
}

function statusBadgeVariant(status: DeviceCommandLogEntry['status']) {
  switch (status) {
    case 'Success':
      return 'default'
    case 'Failed':
      return 'destructive'
    case 'Downloading':
    case 'Installing':
    case 'AppDownload':
    case 'AppInstall':
      return 'secondary'
    case 'AppCheck':
    case 'AppUnblock':
    case 'AppResult':
      return 'outline'
    default:
      return 'outline'
  }
}

function statusBadgeClassName(status: DeviceCommandLogEntry['status']) {
  switch (status) {
    case 'Pending':
      return 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'
    case 'Success':
    case 'AppResult':
      return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
    case 'Downloading':
    case 'Installing':
    case 'AppDownload':
    case 'AppInstall':
      return 'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300'
    case 'AppCheck':
    case 'AppUnblock':
      return 'border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300'
    case 'Failed':
      return ''
    default:
      return ''
  }
}

function truncatePayload(payload: string, maxLen = 120): string {
  const trimmed = payload.trim()
  if (trimmed.length <= maxLen) {
    return trimmed
  }
  return `${trimmed.slice(0, maxLen)}…`
}

function downloadBatteryReportHtml(output: string) {
  const blob = new Blob([output], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'battery_report.html'
  link.click()
  URL.revokeObjectURL(url)
}

export function WindowsDeviceActionLogsTab({ hardwareId }: WindowsDeviceActionLogsTabProps) {
  const { t } = useTranslation()
  const [selectedOutput, setSelectedOutput] = useState<DeviceCommandLogEntry | null>(null)
  const { data, isLoading, isError, error } = useWindowsDeviceCommandLogsQuery(hardwareId)
  const logs = data?.items ?? []

  if (isLoading) {
    return (
      <Card>
        <CardContent className="space-y-3 p-4">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="p-4 text-sm text-destructive">
          {error instanceof Error ? error.message : t('deviceDetail.actionLogs.loadFailed')}
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardContent className="p-0">
          <div className="max-h-[32rem] overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 border-b bg-muted/80 backdrop-blur">
                <tr className="text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">{t('deviceDetail.actionLogs.date')}</th>
                  <th className="px-4 py-2.5 font-medium">{t('deviceDetail.actionLogs.command')}</th>
                  <th className="px-4 py-2.5 font-medium">{t('deviceDetail.actionLogs.payload')}</th>
                  <th className="px-4 py-2.5 font-medium">{t('deviceDetail.actionLogs.status')}</th>
                  <th className="px-4 py-2.5 font-medium">{t('deviceDetail.actionLogs.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((entry) => (
                  <tr key={entry.id} className="border-b last:border-0">
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      {formatDeviceTimestamp(Date.parse(entry.createdAt))}
                    </td>
                    <td className="px-4 py-2.5 font-medium">{entry.commandName}</td>
                    <td
                      className="max-w-xs px-4 py-2.5 font-mono text-xs truncate"
                      title={entry.payload}
                    >
                      {truncatePayload(entry.payload)}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge
                        variant={statusBadgeVariant(entry.status)}
                        className={cn(statusBadgeClassName(entry.status))}
                      >
                        {entry.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!entry.output?.trim()}
                        onClick={() => setSelectedOutput(entry)}
                      >
                        <Eye className="mr-1.5 size-3.5" />
                        {t('deviceDetail.actionLogs.viewOutput')}
                      </Button>
                    </td>
                  </tr>
                ))}
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      {t('deviceDetail.actionLogs.empty')}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={selectedOutput != null} onOpenChange={(open) => !open && setSelectedOutput(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('deviceDetail.actionLogs.outputTitle')}</DialogTitle>
          </DialogHeader>
          <pre className="max-h-96 overflow-auto rounded-md bg-muted p-4 text-xs font-mono whitespace-pre-wrap">
            {selectedOutput?.commandName === 'battery_report' && selectedOutput.output?.trim()
              ? t('deviceDetail.actionLogs.batteryReportReady')
              : selectedOutput?.output?.trim() || t('deviceDetail.actionLogs.noOutput')}
          </pre>
          {selectedOutput?.commandName === 'battery_report' && selectedOutput.output?.trim() ? (
            <DialogFooter>
              <Button
                type="button"
                onClick={() => downloadBatteryReportHtml(selectedOutput.output ?? '')}
              >
                <Download className="mr-1.5 size-3.5" />
                {t('deviceDetail.actionLogs.downloadBatteryReport')}
              </Button>
            </DialogFooter>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
