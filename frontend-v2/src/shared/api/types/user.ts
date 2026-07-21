import type { Platform } from '@/shared/api/types/platform'

export interface Permission {
  id: number
  name: string
}

export interface UserRole {
  id: number
  name: string
  superAdmin: boolean
  permissions: Permission[]
}

export interface User {
  id: number
  login: string
  name: string
  email?: string
  customerId: number
  userRole: UserRole
  singleCustomer?: boolean
  allDevicesAvailable?: boolean
  allConfigAvailable?: boolean
}

export interface DeviceEntityBase {
  id: number
  platform: Platform
}
