import { api } from '@/shared/api/client'
import type { ApiResponse } from '@/shared/api/types/api-response'
import { unwrapApiResponse } from '@/shared/api/types/api-response'

export interface FileEntry {
  id?: number
  filePath?: string
  description?: string
  url?: string
  size?: number
  uploadTime?: number
  devicePath?: string
  external?: boolean
  replaceVariables?: boolean
  usedByConfigurations?: string[]
  usedByIcons?: string[]
}

export async function fetchFiles(): Promise<FileEntry[]> {
  const response = await api.get<ApiResponse<FileEntry[]>>('/private/web-ui-files/search')
  return unwrapApiResponse(response.data)
}

export async function deleteFile(file: FileEntry): Promise<void> {
  const response = await api.post<ApiResponse<unknown>>('/private/web-ui-files/remove', file)
  unwrapApiResponse(response.data)
}

/** Format bytes to human-readable size. */
export function formatFileSize(bytes?: number): string {
  if (bytes == null || bytes < 0) {
    return '—'
  }
  if (bytes === 0) {
    return '0 B'
  }
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** i
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}
