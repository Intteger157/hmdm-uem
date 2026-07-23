import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import {
  refreshWindowsDeviceServices,
  restartWindowsDeviceService,
} from '@/features/windows/api/windows-api'
import { useWindowsDeviceServicesQuery } from '@/features/windows/hooks/use-windows-device-services-query'
import { windowsDeviceDetailQueryKeys } from '@/features/windows/hooks/windows-device-detail-query-keys'
import { waitForWindowsCommandResult } from '@/features/windows/lib/wait-for-command-result'
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
  const queryClient = useQueryClient()
  const autoRefreshAttemptedRef = useRef(false)
  const [refreshing, setRefreshing] = useState(false)
  const [restartingService, setRestartingService] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const { data, isLoading, isError, error } = useWindowsDeviceServicesQuery(hardwareId)
  const services = data?.items ?? []

  useEffect(() => {
    autoRefreshAttemptedRef.current = false
  }, [hardwareId])

  useEffect(() => {
    if (isLoading || autoRefreshAttemptedRef.current) {
      return
    }
    if (services.length > 0) {
      return
    }

    autoRefreshAttemptedRef.current = true
    let cancelled = false

    async function bootstrapServices() {
      setRefreshing(true)
      setActionError(null)
      try {
        const queued = await refreshWindowsDeviceServices(hardwareId)
        await waitForWindowsCommandResult(hardwareId, queued.id)
        if (!cancelled) {
          await queryClient.invalidateQueries({
            queryKey: windowsDeviceDetailQueryKeys.services(hardwareId),
          })
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setActionError(err instanceof Error ? err.message : t('deviceDetail.services.refreshFailed'))
        }
      } finally {
        if (!cancelled) {
          setRefreshing(false)
        }
      }
    }

    void bootstrapServices()
    return () => {
      cancelled = true
    }
  }, [hardwareId, isLoading, queryClient, services.length, t])

  const handleRefresh = async () => {
    setRefreshing(true)
    setActionError(null)
    try {
      const queued = await refreshWindowsDeviceServices(hardwareId)
      await waitForWindowsCommandResult(hardwareId, queued.id)
      await queryClient.invalidateQueries({
        queryKey: windowsDeviceDetailQueryKeys.services(hardwareId),
      })
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : t('deviceDetail.services.refreshFailed'))
    } finally {
      setRefreshing(false)
    }
  }

  const handleRestart = async (serviceName: string) => {
    setRestartingService(serviceName)
    setActionError(null)
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
      await queryClient.invalidateQueries({
        queryKey: windowsDeviceDetailQueryKeys.services(hardwareId),
      })
    } catch (err: unknown) {
      const message = extractRestartErrorMessage(err)
      toast.error(t('deviceDetail.services.restartError', { message }))
    } finally {
      setRestartingService(null)
    }
  }

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

  const queryError = isError
    ? error instanceof Error
      ? error.message
      : t('deviceDetail.services.loadFailed')
    : null

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

        {queryError || actionError ? (
          <div className="px-4 py-3 text-sm text-destructive">{actionError ?? queryError}</div>
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
