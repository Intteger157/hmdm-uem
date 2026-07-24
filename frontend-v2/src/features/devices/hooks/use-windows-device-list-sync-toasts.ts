import { useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import type { DeviceView } from '@/shared/api/types/device'

const SYNC_TIMEOUT_MS = 60_000

interface PendingSync {
  baselineLastUpdate: number
  startedAt: number
  hostname: string
}

export function windowsDeviceSyncToastId(deviceId: number): string {
  return `sync-${deviceId}`
}

export function useWindowsDeviceListSyncToasts(devices: DeviceView[]) {
  const { t } = useTranslation()
  const pendingRef = useRef<Map<number, PendingSync>>(new Map())
  const devicesRef = useRef(devices)
  devicesRef.current = devices

  const startSync = useCallback(
    (device: DeviceView) => {
      const hostname = device.hostname ?? device.number
      pendingRef.current.set(device.id, {
        baselineLastUpdate: device.lastUpdate ?? 0,
        startedAt: Date.now(),
        hostname,
      })
      toast.loading(t('devices.sync.inProgress', { hostname }), {
        id: windowsDeviceSyncToastId(device.id),
        duration: Infinity,
      })
    },
    [t],
  )

  const failSync = useCallback(
    (deviceId: number, message: string) => {
      pendingRef.current.delete(deviceId)
      toast.error(message, {
        id: windowsDeviceSyncToastId(deviceId),
        duration: 4000,
      })
    },
    [],
  )

  useEffect(() => {
    const checkPendingSyncs = () => {
      const pending = pendingRef.current
      if (pending.size === 0) {
        return
      }

      const now = Date.now()
      for (const [deviceId, entry] of pending.entries()) {
        const device = devicesRef.current.find((item) => item.id === deviceId)
        const toastId = windowsDeviceSyncToastId(deviceId)

        if (device?.lastUpdate != null && device.lastUpdate > entry.baselineLastUpdate) {
          pending.delete(deviceId)
          toast.success(t('devices.sync.completed', { hostname: entry.hostname }), {
            id: toastId,
            duration: 4000,
          })
          continue
        }

        if (now - entry.startedAt >= SYNC_TIMEOUT_MS) {
          pending.delete(deviceId)
          toast.error(t('devices.sync.timeout'), {
            id: toastId,
            duration: 4000,
          })
        }
      }
    }

    checkPendingSyncs()
    const intervalId = window.setInterval(checkPendingSyncs, 1000)
    return () => window.clearInterval(intervalId)
  }, [devices, t])

  return { startSync, failSync }
}
