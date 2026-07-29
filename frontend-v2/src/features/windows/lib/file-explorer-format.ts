export const DEFAULT_FILE_EXPLORER_PATH = 'C:\\'

export interface RemoteFileEntry {
  name: string
  isDir: boolean
  size: number
  modTime: string
}

export interface DirListMessage {
  type: 'dir_list'
  path: string
  items: Array<{
    name: string
    is_dir: boolean
    size: number
    mod_time: string
  }>
}

export interface DownloadStartMessage {
  type: 'download_start'
  filename: string
  size: number
}

export interface DownloadEndMessage {
  type: 'download_end'
}

export interface UploadSuccessMessage {
  type: 'upload_success'
}

export interface ExecSuccessMessage {
  type: 'exec_success'
}

export interface FileExplorerErrorMessage {
  type: 'error'
  message: string
}

export type FileExplorerTextMessage =
  | DirListMessage
  | DownloadStartMessage
  | DownloadEndMessage
  | UploadSuccessMessage
  | ExecSuccessMessage
  | FileExplorerErrorMessage

export const UPLOAD_CHUNK_SIZE = 256 * 1024

const RUNNABLE_EXTENSIONS = new Set(['.exe', '.msi', '.bat', '.ps1', '.cmd'])

export function parseFileExplorerTextMessage(raw: string): FileExplorerTextMessage | null {
  try {
    const parsed = JSON.parse(raw) as FileExplorerTextMessage
    if (!parsed || typeof parsed !== 'object' || !('type' in parsed)) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function mapDirListItems(message: DirListMessage): RemoteFileEntry[] {
  return message.items.map((item) => ({
    name: item.name,
    isDir: item.is_dir,
    size: item.size,
    modTime: item.mod_time,
  }))
}

export function sortFileEntries(entries: RemoteFileEntry[]): RemoteFileEntry[] {
  return [...entries].sort((left, right) => {
    if (left.isDir !== right.isDir) {
      return left.isDir ? -1 : 1
    }
    return left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })
  })
}

export function joinWindowsPath(basePath: string, name: string): string {
  const trimmedBase = basePath.replace(/[\\/]+$/, '')
  return `${trimmedBase}\\${name}`
}

export function parentWindowsPath(path: string): string {
  const trimmed = path.replace(/[\\/]+$/, '')
  const separatorIndex = Math.max(trimmed.lastIndexOf('\\'), trimmed.lastIndexOf('/'))
  if (separatorIndex <= 0) {
    return trimmed
  }
  return trimmed.slice(0, separatorIndex)
}

export function formatFileSize(bytes: number): string {
  if (bytes < 0 || Number.isNaN(bytes)) {
    return '—'
  }
  if (bytes < 1024) {
    return `${bytes} B`
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export function formatModifiedTime(value: string): string {
  if (!value.trim()) {
    return '—'
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }
  return parsed.toLocaleString()
}

export function buildReadDirCommand(path: string): string {
  return JSON.stringify({ action: 'read_dir', path })
}

export function buildDownloadCommand(path: string): string {
  return JSON.stringify({ action: 'download', path })
}

export function buildUploadStartCommand(path: string): string {
  return JSON.stringify({ action: 'upload_start', path })
}

export function buildUploadEndCommand(): string {
  return JSON.stringify({ action: 'upload_end' })
}

export function buildExecuteCommand(path: string, args?: string[]): string {
  const payload: { action: 'execute'; path: string; args?: string[] } = {
    action: 'execute',
    path,
  }
  if (args && args.length > 0) {
    payload.args = args
  }
  return JSON.stringify(payload)
}

export function parseExecuteArgs(raw: string): string[] {
  return raw.trim().split(/\s+/).filter((part) => part.length > 0)
}

export function isExeFile(name: string): boolean {
  return name.trim().toLowerCase().endsWith('.exe')
}

export function isRunnableFile(name: string): boolean {
  const lower = name.trim().toLowerCase()
  const dotIndex = lower.lastIndexOf('.')
  if (dotIndex < 0) {
    return false
  }
  return RUNNABLE_EXTENSIONS.has(lower.slice(dotIndex))
}

export async function sendFileUploadChunks(
  socket: WebSocket,
  file: File,
  chunkSize = UPLOAD_CHUNK_SIZE,
): Promise<void> {
  let offset = 0
  while (offset < file.size) {
    const chunk = file.slice(offset, offset + chunkSize)
    socket.send(await chunk.arrayBuffer())
    offset += chunkSize
  }
}
