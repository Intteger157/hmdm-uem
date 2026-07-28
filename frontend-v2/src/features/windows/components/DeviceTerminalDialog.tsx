import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, Plug, PlugZap } from 'lucide-react'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import 'xterm/css/xterm.css'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { buildDeviceTerminalWebSocketUrl } from '@/features/windows/api/device-terminal-socket'

interface DeviceTerminalDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  hardwareId: string
}

type TerminalConnectionStatus = 'idle' | 'connecting' | 'connected' | 'closed' | 'error'

const TERMINAL_THEME = {
  background: '#000000',
  foreground: '#e5e7eb',
  cursor: '#e5e7eb',
}

const TERMINAL_STATUS = {
  initiating:
    '\r\n\x1b[33m[*] Initiating connection to server...\x1b[0m\r\n',
  connected:
    '\x1b[32m[+] Connected to relay server. Waiting for agent...\x1b[0m\r\n',
  failed:
    '\r\n\x1b[31m[-] Connection closed or failed.\x1b[0m\r\n',
} as const

function decodeSocketPayload(data: unknown): string | undefined {
  if (typeof data === 'string') {
    return data
  }
  if (data instanceof ArrayBuffer) {
    return new TextDecoder().decode(data)
  }
  return undefined
}

export function DeviceTerminalDialog({ open, onOpenChange, hardwareId }: DeviceTerminalDialogProps) {
  const { t } = useTranslation()
  const containerRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const socketRef = useRef<WebSocket | null>(null)
  const failureWrittenRef = useRef(false)
  const [status, setStatus] = useState<TerminalConnectionStatus>('idle')

  const closeSocket = useCallback(() => {
    const socket = socketRef.current
    socketRef.current = null
    if (socket && socket.readyState !== WebSocket.CLOSED) {
      socket.close()
    }
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!open || !container) {
      return
    }

    const terminal = new Terminal({
      convertEol: true,
      cursorBlink: true,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
      fontSize: 13,
      theme: TERMINAL_THEME,
    })
    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)
    terminal.open(container)
    fitAddon.fit()

    terminal.onData((data) => {
      const socket = socketRef.current
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(data)
      }
    })

    terminalRef.current = terminal
    fitAddonRef.current = fitAddon

    const resizeObserver = new ResizeObserver(() => fitAddon.fit())
    resizeObserver.observe(container)

    return () => {
      resizeObserver.disconnect()
      closeSocket()
      terminal.dispose()
      terminalRef.current = null
      fitAddonRef.current = null
      setStatus('idle')
    }
  }, [open, closeSocket])

  const handleConnect = () => {
    const terminal = terminalRef.current
    if (!terminal || socketRef.current) {
      return
    }

    failureWrittenRef.current = false
    setStatus('connecting')
    terminal.write(TERMINAL_STATUS.initiating)

    const socket = new WebSocket(buildDeviceTerminalWebSocketUrl(hardwareId))
    socket.binaryType = 'arraybuffer'
    socketRef.current = socket

    const writeFailure = () => {
      if (failureWrittenRef.current) {
        return
      }
      failureWrittenRef.current = true
      terminal.write(TERMINAL_STATUS.failed)
    }

    socket.onopen = () => {
      setStatus('connected')
      terminal.write(TERMINAL_STATUS.connected)
      fitAddonRef.current?.fit()
      terminal.focus()
    }

    socket.onmessage = (event) => {
      const payload = decodeSocketPayload(event.data)
      if (payload != null) {
        terminal.write(payload)
      }
    }

    socket.onerror = () => {
      setStatus('error')
      writeFailure()
    }

    socket.onclose = () => {
      socketRef.current = null
      writeFailure()
      setStatus((current) => (current === 'connected' ? 'closed' : current === 'connecting' ? 'error' : current))
    }
  }

  const handleDisconnect = () => {
    closeSocket()
    setStatus('closed')
  }

  const isConnected = status === 'connected'
  const isConnecting = status === 'connecting'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t('deviceDetail.terminal.title')}</DialogTitle>
          <DialogDescription>{t('deviceDetail.terminal.description')}</DialogDescription>
        </DialogHeader>
        <div
          id="terminal-container"
          ref={containerRef}
          className="h-96 w-full rounded border border-gray-700 bg-black p-2 shadow-none"
        />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.close')}
          </Button>
          {isConnected ? (
            <Button type="button" variant="destructive" onClick={handleDisconnect}>
              <PlugZap className="size-4" />
              {t('deviceDetail.terminal.disconnect')}
            </Button>
          ) : (
            <Button type="button" onClick={handleConnect} disabled={isConnecting}>
              {isConnecting ? <Loader2 className="size-4 animate-spin" /> : <Plug className="size-4" />}
              {isConnecting ? t('deviceDetail.terminal.connecting') : t('deviceDetail.terminal.connect')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
