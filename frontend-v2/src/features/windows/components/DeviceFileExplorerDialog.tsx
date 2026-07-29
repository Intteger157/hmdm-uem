import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowUp, FileText, Folder, Loader2, Play, Upload } from 'lucide-react'
import { toast } from 'sonner'
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
  buildExecuteCommand,
  buildReadDirCommand,
  buildUploadEndCommand,
  buildUploadStartCommand,
  DEFAULT_FILE_EXPLORER_PATH,
  formatFileSize,
  formatModifiedTime,
  isExeFile,
  isRunnableFile,
  joinWindowsPath,
  mapDirListItems,
  parentWindowsPath,
  parseExecuteArgs,
  parseFileExplorerTextMessage,
  sendFileUploadChunks,
  sortFileEntries,
  type RemoteFileEntry,
} from '@/features/windows/lib/file-explorer-format'

interface DeviceFileExplorerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  hardwareId: string
}

type FileExplorerConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'closed'
  | 'error'

const RECONNECT_DELAY_MS = 3000

export function DeviceFileExplorerDialog({ open, onOpenChange, hardwareId }: DeviceFileExplorerDialogProps) {
  const { t } = useTranslation()
  const socketRef = useRef<WebSocket | null>(null)
  const fileChunksRef = useRef<BlobPart[]>([])
  const downloadFilenameRef = useRef('download')
  const downloadLinkRef = useRef<HTMLAnchorElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const currentPathRef = useRef(DEFAULT_FILE_EXPLORER_PATH)
  const intentionalCloseRef = useRef(false)
  const reconnectTimerRef = useRef<number | null>(null)
  const hasConnectedOnceRef = useRef(false)

  const [status, setStatus] = useState<FileExplorerConnectionStatus>('idle')
  const [files, setFiles] = useState<RemoteFileEntry[]>([])
  const [currentPath, setCurrentPath] = useState(DEFAULT_FILE_EXPLORER_PATH)
  const [pathInput, setPathInput] = useState(DEFAULT_FILE_EXPLORER_PATH)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isLoadingDirectory, setIsLoadingDirectory] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  const sortedFiles = useMemo(() => sortFileEntries(files), [files])

  useEffect(() => {
    currentPathRef.current = currentPath
  }, [currentPath])

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current != null) {
      window.clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }
  }, [])

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

  const connect = useCallback(() => {
    const deviceId = hardwareId.trim()
    if (!deviceId || intentionalCloseRef.current) {
      return
    }

    clearReconnectTimer()
    closeSocket()

    if (hasConnectedOnceRef.current) {
      setStatus('reconnecting')
      setStatusMessage(t('deviceDetail.fileExplorer.reconnecting'))
    } else {
      setStatus('connecting')
      setStatusMessage(t('deviceDetail.fileExplorer.connecting'))
    }

    const socket = new WebSocket(buildDeviceFileExplorerWebSocketUrl(deviceId))
    socket.binaryType = 'arraybuffer'
    socketRef.current = socket

    socket.onopen = () => {
      if (socketRef.current !== socket) {
        return
      }
      hasConnectedOnceRef.current = true
      setStatus('connected')
      setStatusMessage(null)
      setErrorMessage(null)
      sendReadDir(currentPathRef.current)
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

        if (message.type === 'upload_success') {
          setIsUploading(false)
          toast.success(t('deviceDetail.fileExplorer.uploadSuccess'))
          sendReadDir(currentPathRef.current)
          return
        }

        if (message.type === 'exec_success') {
          toast.success(t('deviceDetail.fileExplorer.executeSuccess'))
          return
        }

        if (message.type === 'error') {
          setErrorMessage(message.message)
          setIsLoadingDirectory(false)
          setIsDownloading(false)
          setIsUploading(false)
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
      if (socketRef.current !== socket) {
        return
      }
      setErrorMessage(t('deviceDetail.fileExplorer.error'))
      setIsLoadingDirectory(false)
      setIsDownloading(false)
      setIsUploading(false)
    }

    socket.onclose = () => {
      if (socketRef.current !== socket) {
        return
      }
      socketRef.current = null
      setIsLoadingDirectory(false)
      setIsDownloading(false)
      setIsUploading(false)
      fileChunksRef.current = []

      if (intentionalCloseRef.current) {
        setStatus('closed')
        return
      }

      setStatus('reconnecting')
      setStatusMessage(t('deviceDetail.fileExplorer.reconnecting'))
      reconnectTimerRef.current = window.setTimeout(() => {
        connect()
      }, RECONNECT_DELAY_MS)
    }
  }, [clearReconnectTimer, closeSocket, hardwareId, sendReadDir, t, triggerBrowserDownload])

  useEffect(() => {
    if (!open) {
      intentionalCloseRef.current = true
      clearReconnectTimer()
      closeSocket()
      hasConnectedOnceRef.current = false
      setStatus('idle')
      setFiles([])
      setCurrentPath(DEFAULT_FILE_EXPLORER_PATH)
      setPathInput(DEFAULT_FILE_EXPLORER_PATH)
      setStatusMessage(null)
      setErrorMessage(null)
      setIsLoadingDirectory(false)
      setIsDownloading(false)
      setIsUploading(false)
      fileChunksRef.current = []
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      return
    }

    const deviceId = hardwareId.trim()
    if (!deviceId) {
      setStatus('error')
      setStatusMessage(t('deviceDetail.fileExplorer.missingDeviceId'))
      return
    }

    intentionalCloseRef.current = false
    hasConnectedOnceRef.current = false
    setFiles([])
    setCurrentPath(DEFAULT_FILE_EXPLORER_PATH)
    setPathInput(DEFAULT_FILE_EXPLORER_PATH)
    setErrorMessage(null)
    connect()

    return () => {
      intentionalCloseRef.current = true
      clearReconnectTimer()
      closeSocket()
    }
  }, [clearReconnectTimer, closeSocket, connect, hardwareId, open, t])

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
    if (socket?.readyState !== WebSocket.OPEN || isDownloading || isUploading) {
      return
    }
    const fullPath = joinWindowsPath(currentPath, entry.name)
    socket.send(buildDownloadCommand(fullPath))
  }

  const handleExecuteFile = (entry: RemoteFileEntry) => {
    if (entry.isDir || !isRunnableFile(entry.name)) {
      return
    }
    const socket = socketRef.current
    if (socket?.readyState !== WebSocket.OPEN || isDownloading || isUploading) {
      return
    }

    const fullPath = joinWindowsPath(currentPath, entry.name)
    let args: string[] | undefined

    if (isExeFile(entry.name)) {
      const input = window.prompt(t('deviceDetail.fileExplorer.executeArgsPrompt'), '')
      if (input === null) {
        return
      }
      args = parseExecuteArgs(input)
    }

    socket.send(buildExecuteCommand(fullPath, args))
  }

  const handleUploadSelectedFile = async (file: File) => {
    const socket = socketRef.current
    if (socket?.readyState !== WebSocket.OPEN || isDownloading || isUploading) {
      return
    }

    const targetPath = joinWindowsPath(currentPath, file.name)
    setIsUploading(true)
    setErrorMessage(null)

    try {
      socket.send(buildUploadStartCommand(targetPath))
      await sendFileUploadChunks(socket, file)
      socket.send(buildUploadEndCommand())
    } catch {
      setIsUploading(false)
      setErrorMessage(t('deviceDetail.fileExplorer.uploadFailed'))
    }
  }

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) {
      return
    }
    void handleUploadSelectedFile(file)
  }

  const isConnecting = status === 'connecting'
  const isReconnecting = status === 'reconnecting'
  const isBusy = isDownloading || isUploading
  const canInteract = status === 'connected' && !isBusy

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
            <div className="flex shrink-0 flex-wrap gap-2">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                disabled={!canInteract}
                onChange={handleFileInputChange}
              />
              <Button
                type="button"
                variant="outline"
                className="border-zinc-600 bg-zinc-800 text-zinc-200 shadow-none hover:bg-zinc-700 hover:text-zinc-100"
                disabled={!canInteract}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="size-4" />
                {t('deviceDetail.fileExplorer.upload')}
              </Button>
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
            {isReconnecting ? (
              <span className="inline-flex items-center gap-2 text-amber-400">
                <Loader2 className="size-3.5 animate-spin" />
                {statusMessage ?? t('deviceDetail.fileExplorer.reconnecting')}
              </span>
            ) : isConnecting ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="size-3.5 animate-spin text-zinc-300" />
                {statusMessage ?? t('deviceDetail.fileExplorer.connecting')}
              </span>
            ) : isUploading ? (
              <span className="inline-flex items-center gap-2 text-zinc-300">
                <Loader2 className="size-3.5 animate-spin" />
                {t('deviceDetail.fileExplorer.uploading')}
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
              <col className="w-[7%]" />
              <col className="w-[34%]" />
              <col className="w-[14%]" />
              <col className="w-[20%]" />
              <col className="w-[25%]" />
            </colgroup>
            <thead className="sticky top-0 z-10 border-b border-zinc-700 bg-zinc-800">
              <tr className="text-left text-xs uppercase tracking-wide text-zinc-400">
                <th className="px-4 py-2 font-medium">{t('deviceDetail.fileExplorer.columns.icon')}</th>
                <th className="px-4 py-2 font-medium">{t('deviceDetail.fileExplorer.columns.name')}</th>
                <th className="px-4 py-2 font-medium">{t('deviceDetail.fileExplorer.columns.size')}</th>
                <th className="px-4 py-2 font-medium">{t('deviceDetail.fileExplorer.columns.modified')}</th>
                <th className="px-4 py-2 text-right font-medium">{t('deviceDetail.fileExplorer.columns.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {sortedFiles.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-zinc-500">
                    {isConnecting || isReconnecting || isLoadingDirectory
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
                        <div className="inline-flex flex-wrap justify-end gap-1">
                          <button
                            type="button"
                            className="inline-flex items-center border border-zinc-600 bg-zinc-800 px-2 py-1 text-xs text-zinc-300 shadow-none hover:border-zinc-500 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
                            disabled={!canInteract}
                            onClick={() => handleDownloadFile(entry)}
                          >
                            {t('deviceDetail.fileExplorer.download')}
                          </button>
                          {isRunnableFile(entry.name) ? (
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 border border-zinc-600 bg-zinc-800 px-2 py-1 text-xs text-zinc-300 shadow-none hover:border-zinc-500 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
                              disabled={!canInteract}
                              onClick={() => handleExecuteFile(entry)}
                            >
                              <Play className="size-3" />
                              {t('deviceDetail.fileExplorer.run')}
                            </button>
                          ) : null}
                        </div>
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
