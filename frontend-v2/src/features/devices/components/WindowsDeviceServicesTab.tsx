import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import axios from 'axios'
import { RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import {
  getWindowsDeviceServices,
  refreshWindowsDeviceServices,
  restartWindowsDeviceService,
} from '@/features/windows/api/windows-api'
import { waitForWindowsCommandResult } from '@/features/windows/lib/wait-for-command-result'
import type { WindowsService } from '@/shared/api/types/device-detail'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface WindowsDeviceServicesTabProps {
  hardwareId: string
}

function extractRestartErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { error?: string } | undefined
    if (data?.error?.trim()) {
      return data.error.trim()
    }
    if (error.message.trim()) {
      return error.message.trim()
    }
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim()
  }
  return 'Unknown error'
}

export function WindowsDeviceServicesTab({ hardwareId }: WindowsDeviceServicesTabProps) {
  const { t } = useTranslation()
  const [services, setServices] = useState<WindowsService[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [restartingService, setRestartingService] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadServices = useCallback(async () => {
    setError(null)
    const response = await getWindowsDeviceServices(hardwareId)
    setServices(response.items ?? [])
    return response.items ?? []
  }, [hardwareId])

  useEffect(() => {
    let cancelled = false

    async function initialLoad() {
      setLoading(true)
      setError(null)
      try {
        const items = await loadServices()
        if (cancelled) {
          return
        }
        if (items.length === 0) {
          setRefreshing(true)
          const queued = await refreshWindowsDeviceServices(hardwareId)
          await waitForWindowsCommandResult(hardwareId, queued.id)
          if (!cancelled) {
            await loadServices()
          }
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t('deviceDetail.services.loadFailed'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
          setRefreshing(false)
        }
      }
    }

    void initialLoad()
    return () => {
      cancelled = true
    }
  }, [hardwareId, loadServices, t])

  const handleRefresh = async () => {
    setRefreshing(true)
    setError(null)
    try {
      const queued = await refreshWindowsDeviceServices(hardwareId)
      await waitForWindowsCommandResult(hardwareId, queued.id)
      await loadServices()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('deviceDetail.services.refreshFailed'))
    } finally {
      setRefreshing(false)
    }
  }

  const handleRestart = async (serviceName: string) => {
    setRestartingService(serviceName)
    setError(null)
    try {
      const queued = await restartWindowsDeviceService(hardwareId, serviceName)
      const result = await waitForWindowsCommandResult(hardwareId, queued.id)
      if (!result) {
        const message = t('deviceDetail.services.restartTimeout')
        toast.error(t('deviceDetail.services.restartError', { message }))
        return
      }
      if (!result.success) {
        toast.error(t('deviceDetail.services.restartError', { message: result.message }))
        return
      }
      toast.success(t('deviceDetail.services.restartSuccess'))
      await loadServices()
    } catch (err: unknown) {
      const message = extractRestartErrorMessage(err)
      toast.error(t('deviceDetail.services.restartError', { message }))
    } finally {
      setRestartingService(null)
    }
  }

  if (loading) {
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

  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <p className="text-sm text-muted-foreground">{t('deviceDetail.services.subtitle')}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={refreshing}
            onClick={() => void handleRefresh()}
          >
            <RefreshCw className={cn('mr-2 size-4', refreshing && 'animate-spin')} />
            {t('deviceDetail.services.refresh')}
          </Button>
        </div>

        {error ? (
          <div className="px-4 py-3 text-sm text-destructive">{error}</div>
        ) : null}

        <div className="max-h-[32rem] overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 border-b bg-muted/80 backdrop-blur">
              <tr className="text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">{t('deviceDetail.services.displayName')}</th>
                <th className="px-4 py-2.5 font-medium">{t('deviceDetail.services.serviceName')}</th>
                <th className="px-4 py-2.5 font-medium">{t('deviceDetail.services.status')}</th>
                <th className="px-4 py-2.5 font-medium">{t('deviceDetail.services.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {services.map((service) => {
                const isRunning = service.status === 'running'
                const isRestarting = restartingService === service.name
                return (
                  <tr key={service.name} className="border-b last:border-0">
                    <td className="px-4 py-2.5 font-medium">{service.displayName || service.name}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">{service.name}</td>
                    <td className="px-4 py-2.5">
                      <Badge variant={isRunning ? 'default' : 'secondary'}>
                        {isRunning
                          ? t('deviceDetail.services.running')
                          : t('deviceDetail.services.stopped')}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={isRestarting || refreshing}
                        aria-label={t('deviceDetail.services.restart', { service: service.name })}
                        onClick={() => void handleRestart(service.name)}
                      >
                        <RefreshCw className={cn('size-4', isRestarting && 'animate-spin')} />
                      </Button>
                    </td>
                  </tr>
                )
              })}
              {services.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    {t('deviceDetail.services.empty')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
