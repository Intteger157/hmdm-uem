export type DiskEncryptStatus = 'on' | 'off' | 'unknown'

export interface DeviceDiskVolume {
  mountPoint: string
  label?: string
  totalGb: number
  usedGb: number
  encryptStatus: DiskEncryptStatus
}

export type WindowsEncryptionStatus = 'all' | 'partial' | 'none' | 'unknown'

export type WindowsServiceStatus = 'running' | 'stopped'

export interface WindowsService {
  name: string
  displayName: string
  status: WindowsServiceStatus
}

export interface InstalledSoftware {
  name: string
  version: string
  publisher: string
  installDate: string
}

export type LocalUserStatus = 'active' | 'disabled' | 'locked'

export interface LocalUser {
  username: string
  isAdmin: boolean
  status: LocalUserStatus
}
