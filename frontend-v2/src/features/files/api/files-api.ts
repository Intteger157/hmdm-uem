import axios from 'axios'
import { api } from '@/shared/api/client'
import { API_BASE } from '@/shared/api/config'
import type { ApiResponse } from '@/shared/api/types/api-response'
import { unwrapApiResponse } from '@/shared/api/types/api-response'
import { useAuthStore } from '@/features/auth/store/auth-store'
import type { Application } from '@/features/applications/api/applications-api'

export interface FileEntry {
  id?: number
  filePath?: string
  description?: string
  url?: string
  size?: number
  uploadTime?: number
  devicePath?: string
  external?: boolean
  externalUrl?: string
  replaceVariables?: boolean
  usedByConfigurations?: string[]
  usedByIcons?: string[]
  tmpPath?: string
}

export interface FileUploadRawResult {
  name?: string
  serverPath?: string
}

export interface FileStorageLimit {
  sizeLimit?: number
  sizeUsed?: number
}

export interface FileConfigurationLink {
  id?: number
  configurationId?: number
  configurationName?: string
  fileId?: number
  upload?: boolean
  remove?: boolean
  notify?: boolean
}

export async function fetchFiles(search = ''): Promise<FileEntry[]> {
  const trimmed = search.trim()
  const path = trimmed
    ? `/private/web-ui-files/search/${encodeURIComponent(trimmed)}`
    : '/private/web-ui-files/search'
  const response = await api.get<ApiResponse<FileEntry[]>>(path)
  const data = unwrapApiResponse(response.data)
  return Array.isArray(data) ? data : []
}

export async function deleteFile(file: FileEntry): Promise<void> {
  const response = await api.post<ApiResponse<unknown>>('/private/web-ui-files/remove', file)
  unwrapApiResponse(response.data)
}

export async function uploadRawFile(
  file: File,
  onProgress?: (loaded: number, total: number) => void
): Promise<FileUploadRawResult> {
  const formData = new FormData()
  formData.append('file', file)

  const jwt = useAuthStore.getState().jwt
  const response = await axios.post<ApiResponse<FileUploadRawResult>>(
    `${API_BASE}/private/web-ui-files/raw`,
    formData,
    {
      headers: {
        ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
      },
      onUploadProgress: (event) => {
        if (event.total && onProgress) {
          onProgress(event.loaded, event.total)
        }
      },
    }
  )

  return unwrapApiResponse(response.data)
}

export async function updateFile(file: FileEntry): Promise<FileEntry> {
  const response = await api.post<ApiResponse<FileEntry>>('/private/web-ui-files/update', file)
  return unwrapApiResponse(response.data)
}

export async function fetchFileStorageLimit(): Promise<FileStorageLimit> {
  const response = await api.get<ApiResponse<FileStorageLimit>>('/private/web-ui-files/limit')
  return unwrapApiResponse(response.data)
}

export async function fetchFileConfigurations(fileId: number): Promise<FileConfigurationLink[]> {
  const response = await api.get<ApiResponse<FileConfigurationLink[]>>(
    `/private/web-ui-files/configurations/${fileId}`
  )
  const data = unwrapApiResponse(response.data)
  return Array.isArray(data) ? data : []
}

export async function updateFileConfigurations(request: {
  fileId: number
  configurations: FileConfigurationLink[]
}): Promise<void> {
  const response = await api.post<ApiResponse<unknown>>(
    '/private/web-ui-files/configurations',
    request
  )
  unwrapApiResponse(response.data)
}

export async function fetchAppsUsingFile(url: string): Promise<Application[]> {
  const response = await api.get<ApiResponse<Application[]>>(
    `/private/web-ui-files/apps/${encodeURIComponent(url)}`
  )
  return unwrapApiResponse(response.data)
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

export function fileDisplayName(file: FileEntry): string {
  return file.description || (file.external ? file.url : file.filePath) || '—'
}
