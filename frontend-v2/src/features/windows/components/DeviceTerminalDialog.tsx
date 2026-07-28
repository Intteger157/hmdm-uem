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
import { normalizeTerminalInput } from '@/features/windows/lib/terminal-input'

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
  const containerRef = useRef<HTMLDivElement | null>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const socketRef = useRef<WebSocket | null>(null)
  const failureWrittenRef = useRef(false)
  const [status, setStatus] = useState<TerminalConnectionStatus>('idle')
  const [terminalReady, setTerminalReady] = useState(false)

  const closeSocket = useCallback(() => {
    const socket = socketRef.current
    socketRef.current = null
    if (socket && socket.readyState !== WebSocket.CLOSED) {
      socket.close()
    }
  }, [])

  const disposeTerminal = useCallback(() => {
    resizeObserverRef.current?.disconnect()
    resizeObserverRef.current = null
    closeSocket()
    terminalRef.current?.dispose()
    terminalRef.current = null
    fitAddonRef.current = null
    setTerminalReady(false)
  }, [closeSocket])

  const mountTerminal = useCallback((container: HTMLDivElement) => {
    if (terminalRef.current) {
      return terminalRef.current
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
        socket.send(normalizeTerminalInput(data))
      }
    })

    terminalRef.current = terminal
    fitAddonRef.current = fitAddon

    resizeObserverRef.current?.disconnect()
    const resizeObserver = new ResizeObserver(() => fitAddon.fit())
    resizeObserver.observe(container)
    resizeObserverRef.current = resizeObserver

    setTerminalReady(true)
    return terminal
  }, [])

  const setContainerRef = useCallback(
    (node: HTMLDivElement | null) => {
      containerRef.current = node
      if (!node || !open) {
        return
      }
      mountTerminal(node)
    },
    [mountTerminal, open],
  )

  useEffect(() => {
    if (!open) {
      disposeTerminal()
      setStatus('idle')
      return
    }

    const container = containerRef.current
    if (container) {
      mountTerminal(container)
    }
  }, [open, disposeTerminal, mountTerminal])

  const handleConnect = useCallback(() => {
    console.log('[Terminal] Connect button clicked, initializing WS...')

    if (socketRef.current) {
      console.warn('[Terminal] WebSocket already active, ignoring duplicate connect')
      return
    }

    const container = containerRef.current
    const terminal = container ? mountTerminal(container) : terminalRef.current
    if (!terminal) {
      console.error('[Terminal] xterm is not ready yet')
      return
    }

    const deviceId = hardwareId.trim()
    if (!deviceId) {
      console.error('[Terminal] hardwareId is missing')
      terminal.write('\r\n\x1b[31m[-] Device ID is missing.\x1b[0m\r\n')
      return
    }

    failureWrittenRef.current = false
    setStatus('connecting')
    terminal.write(TERMINAL_STATUS.initiating)

    const wsUrl = buildDeviceTerminalWebSocketUrl(deviceId)
    console.log('[Terminal] Opening WebSocket:', wsUrl)

    const socket = new WebSocket(wsUrl)
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
      console.log('[Terminal] WebSocket connected')
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
      console.error('[Terminal] WebSocket error')
      setStatus('error')
      writeFailure()
    }

    socket.onclose = (event) => {
      console.log('[Terminal] WebSocket closed', { code: event.code, reason: event.reason, wasClean: event.wasClean })
      socketRef.current = null
      writeFailure()
      setStatus((current) => (current === 'connected' ? 'closed' : current === 'connecting' ? 'error' : current))
    }
  }, [hardwareId, mountTerminal])

  const handleDisconnect = useCallback(() => {
    closeSocket()
    setStatus('closed')
  }, [closeSocket])

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
          ref={setContainerRef}
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
            <Button
              type="button"
              onClick={handleConnect}
              disabled={isConnecting || !terminalReady}
            >
              {isConnecting ? <Loader2 className="size-4 animate-spin" /> : <Plug className="size-4" />}
              {isConnecting ? t('deviceDetail.terminal.connecting') : t('deviceDetail.terminal.connect')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
