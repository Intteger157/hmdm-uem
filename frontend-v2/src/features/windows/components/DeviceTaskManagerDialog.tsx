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
  const [searchQuery, setSearchQuery] = useState('')

  const closeSocket = useCallback(() => {
    const socket = socketRef.current
    socketRef.current = null
    if (socket && socket.readyState !== WebSocket.CLOSED) {
      socket.close()
    }
  }, [])

  const sortedProcesses = useMemo(() => sortProcessesByMemoryDesc(processes), [processes])

  const filteredProcesses = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) {
      return sortedProcesses
    }
    return sortedProcesses.filter((process) => process.name.toLowerCase().includes(query))
  }, [searchQuery, sortedProcesses])

  useEffect(() => {
    if (!open) {
      closeSocket()
      setStatus('idle')
      setProcesses([])
      setStatusMessage(null)
      setSearchQuery('')
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
  const hasProcesses = sortedProcesses.length > 0
  const showFilteredEmpty = hasProcesses && filteredProcesses.length === 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden border border-zinc-700 bg-zinc-900 p-0 shadow-none sm:max-w-4xl">
        <DialogHeader className="border-b border-zinc-700 bg-zinc-800 px-4 py-3">
          <DialogTitle className="text-zinc-100">{t('deviceDetail.taskManager.title')}</DialogTitle>
          <DialogDescription className="text-zinc-400">
            {t('deviceDetail.taskManager.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 border-b border-zinc-700 bg-zinc-800/80 px-4 py-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 text-xs text-zinc-400">
            {isConnecting ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="size-3.5 animate-spin text-zinc-300" />
                {statusMessage ?? t('deviceDetail.taskManager.connecting')}
              </span>
            ) : (
              <span>
                {statusMessage ??
                  t('deviceDetail.taskManager.processCount', {
                    count: searchQuery.trim() ? filteredProcesses.length : sortedProcesses.length,
                  })}
              </span>
            )}
          </div>

          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={t('deviceDetail.taskManager.searchPlaceholder')}
            className="h-8 w-full border border-zinc-600 bg-zinc-800 px-3 text-sm text-zinc-100 shadow-none outline-none placeholder:text-zinc-500 focus:border-zinc-400 sm:w-64"
          />
        </div>

        <div className="max-h-[28rem] overflow-auto bg-zinc-900">
          <table className="w-full table-fixed border-collapse text-sm">
            <colgroup>
              <col className="w-[38%]" />
              <col className="w-[12%]" />
              <col className="w-[14%]" />
              <col className="w-[16%]" />
              <col className="w-[20%]" />
            </colgroup>
            <thead className="sticky top-0 z-10 border-b border-zinc-700 bg-zinc-800">
              <tr className="text-left text-xs uppercase tracking-wide text-zinc-400">
                <th className="px-4 py-2 font-medium">{t('deviceDetail.taskManager.columns.name')}</th>
                <th className="px-4 py-2 font-medium">{t('deviceDetail.taskManager.columns.pid')}</th>
                <th className="px-4 py-2 font-medium">{t('deviceDetail.taskManager.columns.cpu')}</th>
                <th className="px-4 py-2 font-medium">{t('deviceDetail.taskManager.columns.memory')}</th>
                <th className="px-4 py-2 text-right font-medium">{t('deviceDetail.taskManager.columns.action')}</th>
              </tr>
            </thead>
            <tbody>
              {!hasProcesses ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-zinc-500">
                    {isConnecting
                      ? t('deviceDetail.taskManager.loadingProcesses')
                      : t('deviceDetail.taskManager.emptyProcesses')}
                  </td>
                </tr>
              ) : showFilteredEmpty ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-zinc-500">
                    {t('deviceDetail.taskManager.searchEmpty')}
                  </td>
                </tr>
              ) : (
                filteredProcesses.map((process) => (
                  <tr key={process.pid} className="border-b border-zinc-800 hover:bg-zinc-800/60">
                    <td className="truncate px-4 py-2 font-medium text-zinc-100">{process.name}</td>
                    <td className="px-4 py-2 text-zinc-300">{process.pid}</td>
                    <td className="px-4 py-2 text-zinc-300">{process.cpuPercent.toFixed(1)}</td>
                    <td className="px-4 py-2 text-zinc-300">{formatMemoryMegabytes(process.memoryBytes)}</td>
                    <td className="px-4 py-2 text-right">
                      <button
                        type="button"
                        className="inline-flex size-7 items-center justify-center border border-zinc-600 bg-zinc-800 text-zinc-400 shadow-none hover:border-red-900 hover:bg-red-950 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label={t('deviceDetail.taskManager.killProcess', { name: process.name })}
                        disabled={status !== 'connected'}
                        onClick={() => handleKillProcess(process.pid)}
                      >
                        <X className="size-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <DialogFooter className="border-t border-zinc-700 bg-zinc-800 px-4 py-3">
          <Button
            type="button"
            variant="outline"
            className="border-zinc-600 bg-zinc-800 text-zinc-200 shadow-none hover:bg-zinc-700 hover:text-zinc-100"
            onClick={() => onOpenChange(false)}
          >
            {t('common.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
