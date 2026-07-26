export interface StoredFile {
  id: number
  filename: string
  originalName: string
  sizeBytes: number
  sha256: string
  uploadDate: string
  downloadUrl: string
}

export interface StoredFileListResponse {
  items: StoredFile[]
  totalItemsCount: number
}

export interface ProfileFileDeploymentRule {
  id?: number
  fileId: number
  destinationPath: string
  unzip: boolean
  postActionScript?: string
}

export interface ProfileFileDeploymentsResponse {
  items: ProfileFileDeploymentRule[]
}
