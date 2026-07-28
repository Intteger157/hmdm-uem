import axios from 'axios'
import { WINDOWS_API_BASE } from '@/shared/api/config'
import { useAuthStore } from '@/features/auth/store/auth-store'
import type {
  ProfileFileDeploymentsResponse,
  ProfileFileDeploymentRule,
  StoredFile,
  StoredFileListResponse,
} from '@/features/windows/files/types/stored-file'
import type { UploadProgressState } from '@/features/windows/applications/utils/installer-upload'

export async function fetchStoredFiles(): Promise<StoredFile[]> {
  const jwt = useAuthStore.getState().jwt
  const response = await axios.get<StoredFileListResponse>(`${WINDOWS_API_BASE}/files`, {
    headers: jwt ? { Authorization: `Bearer ${jwt}` } : {},
  })
  return response.data.items
}

export interface UploadStoredFileOptions {
  onUploadProgress?: (progress: UploadProgressState) => void
}

export async function uploadStoredFile(
  file: File,
  options?: UploadStoredFileOptions,
): Promise<StoredFile> {
  const formData = new FormData()
  formData.append('file', file)

  const jwt = useAuthStore.getState().jwt
  const response = await axios.post<StoredFile>(`${WINDOWS_API_BASE}/files/upload`, formData, {
    headers: {
      ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
    },
    timeout: 0,
    onUploadProgress: (event) => {
      if (!options?.onUploadProgress) {
        return
      }
      const total = event.total ?? file.size
      const loaded = event.loaded
      const percent = total > 0 ? Math.round((loaded * 100) / total) : 0
      options.onUploadProgress({ percent, loaded, total })
    },
  })
  return response.data
}

export interface DeleteStoredFileOptions {
  force?: boolean
}

export async function deleteStoredFile(id: number, options?: DeleteStoredFileOptions): Promise<void> {
  const jwt = useAuthStore.getState().jwt
  await axios.delete(`${WINDOWS_API_BASE}/files/${id}`, {
    headers: jwt ? { Authorization: `Bearer ${jwt}` } : {},
    params: options?.force ? { force: 'true' } : undefined,
  })
}

export async function fetchProfileFileDeployments(profileId: number): Promise<ProfileFileDeploymentRule[]> {
  const jwt = useAuthStore.getState().jwt
  const response = await axios.get<ProfileFileDeploymentsResponse>(
    `${WINDOWS_API_BASE}/configurations/${profileId}/file-deployments`,
    {
      headers: jwt ? { Authorization: `Bearer ${jwt}` } : {},
    },
  )
  return response.data.items
}

export async function assignProfileFileDeployments(
  profileId: number,
  items: ProfileFileDeploymentRule[],
): Promise<ProfileFileDeploymentRule[]> {
  const jwt = useAuthStore.getState().jwt
  const response = await axios.post<ProfileFileDeploymentsResponse>(
    `${WINDOWS_API_BASE}/configurations/${profileId}/file-deployments`,
    { items },
    {
      headers: jwt ? { Authorization: `Bearer ${jwt}` } : {},
    },
  )
  return response.data.items
}
