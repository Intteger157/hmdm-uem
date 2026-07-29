import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowUp, FileText, Folder, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { buildDeviceFileExplorerWebSocketUrl } from '@/features/windows/api/device-filexplorer-socket'
import {
  buildDownloadCommand,
  buildReadDirCommand,
  DEFAULT_FILE_EXPLORER_PATH,
  formatFileSize,
  formatModifiedTime,
  joinWindowsPath,
  mapDirListItems,
  parentWindowsPath,
  parseFileExplorerTextMessage,
  sortFileEntries,
  type RemoteFileEntry,
} from '@/features/windows/lib/file-explorer-format'

interface DeviceFileExplorerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  hardwareId: string
}

type FileExplorerConnectionStatus = 'idle' | 'connecting' | 'connected' | 'closed' | 'error'

export function DeviceFileExplorerDialog({ open, onOpenChange, hardwareId }: DeviceFileExplorerDialogProps) {
  const { t } = useTranslation()
  const socketRef = useRef<WebSocket | null>(null)
  const fileChunksRef = useRef<BlobPart[]>([])
  const downloadFilenameRef = useRef('download')
  const downloadLinkRef = useRef<HTMLAnchorElement>(null)

  const [status, setStatus] = useState<FileExplorerConnectionStatus>('idle')
  const [files, setFiles] = useState<RemoteFileEntry[]>([])
  const [currentPath, setCurrentPath] = useState(DEFAULT_FILE_EXPLORER_PATH)
  const [pathInput, setPathInput] = useState(DEFAULT_FILE_EXPLORER_PATH)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isLoadingDirectory, setIsLoadingDirectory] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)

  const sortedFiles = useMemo(() => sortFileEntries(files), [files])

  const closeSocket = useCallback(() => {
    const socket = socketRef.current
    socketRef.current = null
    if (socket && socket.readyState !== WebSocket.CLOSED) {
      socket.close()
    }
  }, [])

  const sendReadDir = useCallback((path: string) => {
    const socket = socketRef.current
    if (socket?.readyState !== WebSocket.OPEN) {
      return
    }
    setIsLoadingDirectory(true)
    setErrorMessage(null)
    socket.send(buildReadDirCommand(path))
  }, [])

  const triggerBrowserDownload = useCallback((blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const link = downloadLinkRef.current ?? document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
  }, [])

  useEffect(() => {
    if (!open) {
      closeSocket()
      setStatus('idle')
      setFiles([])
      setCurrentPath(DEFAULT_FILE_EXPLORER_PATH)
      setPathInput(DEFAULT_FILE_EXPLORER_PATH)
      setStatusMessage(null)
      setErrorMessage(null)
      setIsLoadingDirectory(false)
      setIsDownloading(false)
      fileChunksRef.current = []
      return
    }

    const deviceId = hardwareId.trim()
    if (!deviceId) {
      setStatus('error')
      setStatusMessage(t('deviceDetail.fileExplorer.missingDeviceId'))
      return
    }

    setStatus('connecting')
    setStatusMessage(t('deviceDetail.fileExplorer.connecting'))
    setFiles([])
    setCurrentPath(DEFAULT_FILE_EXPLORER_PATH)
    setPathInput(DEFAULT_FILE_EXPLORER_PATH)
    setErrorMessage(null)

    const socket = new WebSocket(buildDeviceFileExplorerWebSocketUrl(deviceId))
    socket.binaryType = 'arraybuffer'
    socketRef.current = socket

    socket.onopen = () => {
      setStatus('connected')
      setStatusMessage(t('deviceDetail.fileExplorer.waitingForAgent'))
      sendReadDir(DEFAULT_FILE_EXPLORER_PATH)
    }

    socket.onmessage = (event) => {
      if (typeof event.data === 'string') {
        const message = parseFileExplorerTextMessage(event.data)
        if (!message) {
          return
        }

        if (message.type === 'dir_list') {
          setFiles(mapDirListItems(message))
          setCurrentPath(message.path)
          setPathInput(message.path)
          setIsLoadingDirectory(false)
          setStatusMessage(null)
          setErrorMessage(null)
          return
        }

        if (message.type === 'download_start') {
          fileChunksRef.current = []
          downloadFilenameRef.current = message.filename || 'download'
          setIsDownloading(true)
          setErrorMessage(null)
          return
        }

        if (message.type === 'download_end') {
          const blob = new Blob(fileChunksRef.current)
          triggerBrowserDownload(blob, downloadFilenameRef.current)
          fileChunksRef.current = []
          setIsDownloading(false)
          return
        }

        if (message.type === 'error') {
          setErrorMessage(message.message)
          setIsLoadingDirectory(false)
          setIsDownloading(false)
          fileChunksRef.current = []
        }
        return
      }

      if (event.data instanceof Blob) {
        fileChunksRef.current.push(event.data)
        return
      }

      if (event.data instanceof ArrayBuffer) {
        fileChunksRef.current.push(event.data)
      }
    }

    socket.onerror = () => {
      setStatus('error')
      setStatusMessage(t('deviceDetail.fileExplorer.error'))
      setIsLoadingDirectory(false)
      setIsDownloading(false)
    }

    socket.onclose = () => {
      socketRef.current = null
      setStatus((current) => (current === 'connecting' ? 'error' : 'closed'))
      setStatusMessage((current) => current ?? t('deviceDetail.fileExplorer.disconnected'))
      setIsLoadingDirectory(false)
      setIsDownloading(false)
    }

    return () => {
      closeSocket()
    }
  }, [closeSocket, hardwareId, open, sendReadDir, t, triggerBrowserDownload])

  const handleNavigate = () => {
    const nextPath = pathInput.trim()
    if (!nextPath) {
      return
    }
    sendReadDir(nextPath)
  }

  const handleGoUp = () => {
    const parentPath = parentWindowsPath(currentPath)
    if (!parentPath || parentPath === currentPath) {
      return
    }
    setPathInput(parentPath)
    sendReadDir(parentPath)
  }

  const handleOpenDirectory = (entry: RemoteFileEntry) => {
    if (!entry.isDir) {
      return
    }
    const nextPath = joinWindowsPath(currentPath, entry.name)
    setPathInput(nextPath)
    sendReadDir(nextPath)
  }

  const handleDownloadFile = (entry: RemoteFileEntry) => {
    if (entry.isDir) {
      return
    }
    const socket = socketRef.current
    if (socket?.readyState !== WebSocket.OPEN || isDownloading) {
      return
    }
    const fullPath = joinWindowsPath(currentPath, entry.name)
    socket.send(buildDownloadCommand(fullPath))
  }

  const isConnecting = status === 'connecting'
  const canInteract = status === 'connected' && !isConnecting

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden border border-zinc-700 bg-zinc-900 p-0 shadow-none sm:max-w-4xl">
        <DialogHeader className="border-b border-zinc-700 bg-zinc-800 px-4 py-3">
          <DialogTitle className="text-zinc-100">{t('deviceDetail.fileExplorer.title')}</DialogTitle>
          <DialogDescription className="text-zinc-400">
            {t('deviceDetail.fileExplorer.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 border-b border-zinc-700 bg-zinc-800/80 px-4 py-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              type="text"
              value={pathInput}
              onChange={(event) => setPathInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  handleNavigate()
                }
              }}
              className="h-9 min-w-0 flex-1 border border-zinc-600 bg-zinc-800 px-3 text-sm text-zinc-100 shadow-none outline-none placeholder:text-zinc-500 focus:border-zinc-400"
              placeholder={DEFAULT_FILE_EXPLORER_PATH}
              disabled={!canInteract}
            />
            <div className="flex shrink-0 gap-2">
              <Button
                type="button"
                variant="outline"
                className="border-zinc-600 bg-zinc-800 text-zinc-200 shadow-none hover:bg-zinc-700 hover:text-zinc-100"
                disabled={!canInteract}
                onClick={handleGoUp}
              >
                <ArrowUp className="size-4" />
                {t('deviceDetail.fileExplorer.up')}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="border-zinc-600 bg-zinc-800 text-zinc-200 shadow-none hover:bg-zinc-700 hover:text-zinc-100"
                disabled={!canInteract}
                onClick={handleNavigate}
              >
                {t('deviceDetail.fileExplorer.go')}
              </Button>
            </div>
          </div>

          <div className="min-h-5 text-xs text-zinc-400">
            {isConnecting ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="size-3.5 animate-spin text-zinc-300" />
                {statusMessage ?? t('deviceDetail.fileExplorer.connecting')}
              </span>
            ) : isDownloading ? (
              <span className="inline-flex items-center gap-2 text-zinc-300">
                <Loader2 className="size-3.5 animate-spin" />
                {t('deviceDetail.fileExplorer.downloading')}
              </span>
            ) : isLoadingDirectory ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="size-3.5 animate-spin text-zinc-300" />
                {t('deviceDetail.fileExplorer.loadingDirectory')}
              </span>
            ) : (
              <span>
                {statusMessage ??
                  t('deviceDetail.fileExplorer.itemCount', {
                    count: sortedFiles.length,
                    path: currentPath,
                  })}
              </span>
            )}
          </div>

          {errorMessage ? <p className="text-xs text-red-400">{errorMessage}</p> : null}
        </div>

        <div className="max-h-[28rem] overflow-auto bg-zinc-900">
          <table className="w-full table-fixed border-collapse text-sm">
            <colgroup>
              <col className="w-[8%]" />
              <col className="w-[42%]" />
              <col className="w-[18%]" />
              <col className="w-[22%]" />
              <col className="w-[10%]" />
            </colgroup>
            <thead className="sticky top-0 z-10 border-b border-zinc-700 bg-zinc-800">
              <tr className="text-left text-xs uppercase tracking-wide text-zinc-400">
                <th className="px-4 py-2 font-medium">{t('deviceDetail.fileExplorer.columns.icon')}</th>
                <th className="px-4 py-2 font-medium">{t('deviceDetail.fileExplorer.columns.name')}</th>
                <th className="px-4 py-2 font-medium">{t('deviceDetail.fileExplorer.columns.size')}</th>
                <th className="px-4 py-2 font-medium">{t('deviceDetail.fileExplorer.columns.modified')}</th>
                <th className="px-4 py-2 text-right font-medium">{t('deviceDetail.fileExplorer.columns.action')}</th>
              </tr>
            </thead>
            <tbody>
              {sortedFiles.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-zinc-500">
                    {isConnecting || isLoadingDirectory
                      ? t('deviceDetail.fileExplorer.loadingDirectory')
                      : t('deviceDetail.fileExplorer.emptyDirectory')}
                  </td>
                </tr>
              ) : (
                sortedFiles.map((entry) => (
                  <tr
                    key={entry.name}
                    className="border-b border-zinc-800 hover:bg-zinc-800/60"
                    onDoubleClick={() => handleOpenDirectory(entry)}
                  >
                    <td className="px-4 py-2 text-zinc-400">
                      {entry.isDir ? <Folder className="size-4 text-sky-400" /> : <FileText className="size-4" />}
                    </td>
                    <td
                      className={`truncate px-4 py-2 font-medium ${
                        entry.isDir ? 'cursor-pointer text-sky-300' : 'text-zinc-100'
                      }`}
                    >
                      {entry.name}
                    </td>
                    <td className="px-4 py-2 text-zinc-300">
                      {entry.isDir ? '—' : formatFileSize(entry.size)}
                    </td>
                    <td className="px-4 py-2 text-zinc-300">{formatModifiedTime(entry.modTime)}</td>
                    <td className="px-4 py-2 text-right">
                      {!entry.isDir ? (
                        <button
                          type="button"
                          className="inline-flex items-center border border-zinc-600 bg-zinc-800 px-2 py-1 text-xs text-zinc-300 shadow-none hover:border-zinc-500 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
                          disabled={!canInteract || isDownloading}
                          onClick={() => handleDownloadFile(entry)}
                        >
                          {t('deviceDetail.fileExplorer.download')}
                        </button>
                      ) : null}
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

        <a ref={downloadLinkRef} className="hidden" aria-hidden tabIndex={-1} />
      </DialogContent>
    </Dialog>
  )
}
