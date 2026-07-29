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

export interface FileExplorerErrorMessage {
  type: 'error'
  message: string
}

export type FileExplorerTextMessage =
  | DirListMessage
  | DownloadStartMessage
  | DownloadEndMessage
  | FileExplorerErrorMessage

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
