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
