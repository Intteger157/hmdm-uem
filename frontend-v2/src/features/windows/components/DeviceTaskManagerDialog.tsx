import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { buildDeviceTaskManagerWebSocketUrl } from '@/features/windows/api/device-taskmgr-socket'
import {
  formatMemoryMegabytes,
  parseProcessListMessage,
  sortProcessesByMemoryDesc,
  type RemoteProcessSnapshot,
} from '@/features/windows/lib/task-manager-format'

interface DeviceTaskManagerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  hardwareId: string
}

type TaskManagerConnectionStatus = 'idle' | 'connecting' | 'connected' | 'closed' | 'error'

export function DeviceTaskManagerDialog({ open, onOpenChange, hardwareId }: DeviceTaskManagerDialogProps) {
  const { t } = useTranslation()
  const socketRef = useRef<WebSocket | null>(null)
  const [status, setStatus] = useState<TaskManagerConnectionStatus>('idle')
  const [processes, setProcesses] = useState<RemoteProcessSnapshot[]>([])
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  const closeSocket = useCallback(() => {
    const socket = socketRef.current
    socketRef.current = null
    if (socket && socket.readyState !== WebSocket.CLOSED) {
      socket.close()
    }
  }, [])

  const sortedProcesses = useMemo(() => sortProcessesByMemoryDesc(processes), [processes])

  useEffect(() => {
    if (!open) {
      closeSocket()
      setStatus('idle')
      setProcesses([])
      setStatusMessage(null)
      return
    }

    const deviceId = hardwareId.trim()
    if (!deviceId) {
      setStatus('error')
      setStatusMessage(t('deviceDetail.taskManager.missingDeviceId'))
      return
    }

    setStatus('connecting')
    setStatusMessage(t('deviceDetail.taskManager.connecting'))
    setProcesses([])

    const socket = new WebSocket(buildDeviceTaskManagerWebSocketUrl(deviceId))
    socketRef.current = socket

    socket.onopen = () => {
      setStatus('connected')
      setStatusMessage(t('deviceDetail.taskManager.waitingForAgent'))
    }

    socket.onmessage = (event) => {
      const raw = typeof event.data === 'string' ? event.data : ''
      const nextProcesses = parseProcessListMessage(raw)
      if (nextProcesses) {
        setProcesses(nextProcesses)
        setStatusMessage(null)
        return
      }

      try {
        const parsed = JSON.parse(raw) as { type?: string; message?: string }
        if (parsed.type === 'error' && parsed.message) {
          setStatusMessage(parsed.message)
        }
      } catch {
        // Ignore non-JSON frames.
      }
    }

    socket.onerror = () => {
      setStatus('error')
      setStatusMessage(t('deviceDetail.taskManager.error'))
    }

    socket.onclose = () => {
      socketRef.current = null
      setStatus((current) => (current === 'connecting' ? 'error' : 'closed'))
      setStatusMessage((current) => current ?? t('deviceDetail.taskManager.disconnected'))
    }

    return () => {
      closeSocket()
    }
  }, [closeSocket, hardwareId, open, t])

  const handleKillProcess = (pid: number) => {
    const socket = socketRef.current
    if (socket?.readyState !== WebSocket.OPEN) {
      return
    }
    socket.send(JSON.stringify({ action: 'kill', pid }))
  }

  const isConnecting = status === 'connecting'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden border border-gray-300 p-0 shadow-none sm:max-w-4xl">
        <DialogHeader className="border-b border-gray-300 bg-gray-100 px-4 py-3">
          <DialogTitle>{t('deviceDetail.taskManager.title')}</DialogTitle>
          <DialogDescription>{t('deviceDetail.taskManager.description')}</DialogDescription>
        </DialogHeader>

        <div className="border-b border-gray-200 bg-gray-50 px-4 py-2 text-xs text-gray-600">
          {isConnecting ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="size-3.5 animate-spin" />
              {statusMessage ?? t('deviceDetail.taskManager.connecting')}
            </span>
          ) : (
            <span>{statusMessage ?? t('deviceDetail.taskManager.processCount', { count: sortedProcesses.length })}</span>
          )}
        </div>

        <div className="max-h-[28rem] overflow-auto bg-white">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 border-b border-gray-300 bg-gray-100">
              <tr className="text-left text-xs uppercase tracking-wide text-gray-600">
                <th className="px-4 py-2 font-medium">{t('deviceDetail.taskManager.columns.name')}</th>
                <th className="px-4 py-2 font-medium">{t('deviceDetail.taskManager.columns.pid')}</th>
                <th className="px-4 py-2 font-medium">{t('deviceDetail.taskManager.columns.cpu')}</th>
                <th className="px-4 py-2 font-medium">{t('deviceDetail.taskManager.columns.memory')}</th>
                <th className="px-4 py-2 font-medium text-right">{t('deviceDetail.taskManager.columns.action')}</th>
              </tr>
            </thead>
            <tbody>
              {sortedProcesses.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">
                    {isConnecting
                      ? t('deviceDetail.taskManager.loadingProcesses')
                      : t('deviceDetail.taskManager.emptyProcesses')}
                  </td>
                </tr>
              ) : (
                sortedProcesses.map((process) => (
                  <tr key={process.pid} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium text-gray-900">{process.name}</td>
                    <td className="px-4 py-2 text-gray-700">{process.pid}</td>
                    <td className="px-4 py-2 text-gray-700">{process.cpuPercent.toFixed(1)}</td>
                    <td className="px-4 py-2 text-gray-700">{formatMemoryMegabytes(process.memoryBytes)}</td>
                    <td className="px-4 py-2 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="rounded-sm border border-gray-300 bg-gray-100 text-gray-600 shadow-none hover:bg-gray-200 hover:text-gray-900"
                        aria-label={t('deviceDetail.taskManager.killProcess', { name: process.name })}
                        disabled={status !== 'connected'}
                        onClick={() => handleKillProcess(process.pid)}
                      >
                        <X className="size-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <DialogFooter className="border-t border-gray-300 bg-gray-50 px-4 py-3">
          <Button type="button" variant="outline" className="shadow-none" onClick={() => onOpenChange(false)}>
            {t('common.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
