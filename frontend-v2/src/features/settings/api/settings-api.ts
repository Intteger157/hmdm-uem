import { api } from '@/shared/api/client'
import type { ApiResponse } from '@/shared/api/types/api-response'
import { unwrapApiResponse } from '@/shared/api/types/api-response'

export interface Settings {
  id?: number
  backgroundColor?: string
  textColor?: string
  backgroundImageUrl?: string
  iconSize?: string
  desktopHeader?: string
  desktopHeaderTemplate?: string
  useDefaultLanguage?: boolean
  language?: string
  createNewDevices?: boolean
  newDeviceGroupId?: number | null
  newDeviceConfigurationId?: number | null
  phoneNumberFormat?: string
  customPropertyName1?: string
  customPropertyName2?: string
  customPropertyName3?: string
  customMultiline1?: boolean
  customMultiline2?: boolean
  customMultiline3?: boolean
  customSend1?: boolean
  customSend2?: boolean
  customSend3?: boolean
  sendDescription?: boolean
  passwordLength?: number
  passwordStrength?: number
  passwordReset?: boolean
  idleLogout?: number | null
  [key: string]: unknown
}

export interface UserRoleSettings {
  id?: number
  roleId?: number
  columnDisplayedDeviceStatus?: boolean
  columnDisplayedDeviceDate?: boolean
  columnDisplayedDeviceNumber?: boolean
  columnDisplayedDeviceModel?: boolean
  columnDisplayedDevicePermissionsStatus?: boolean
  columnDisplayedDeviceAppInstallStatus?: boolean
  columnDisplayedDeviceFilesStatus?: boolean
  columnDisplayedDeviceConfiguration?: boolean
  columnDisplayedDeviceImei?: boolean
  columnDisplayedDevicePhone?: boolean
  columnDisplayedDeviceDesc?: boolean
  columnDisplayedDeviceGroup?: boolean
  columnDisplayedLauncherVersion?: boolean
  columnDisplayedBatteryLevel?: boolean
  columnDisplayedDefaultLauncher?: boolean
  columnDisplayedMdmMode?: boolean
  columnDisplayedKioskMode?: boolean
  columnDisplayedAndroidVersion?: boolean
  columnDisplayedEnrollmentDate?: boolean
  columnDisplayedSerial?: boolean
  columnDisplayedPublicIp?: boolean
  columnDisplayedCustom1?: boolean
  columnDisplayedCustom2?: boolean
  columnDisplayedCustom3?: boolean
  [key: string]: unknown
}

export async function fetchSettings(): Promise<Settings> {
  const response = await api.get<ApiResponse<Settings>>('/private/settings')
  return unwrapApiResponse(response.data)
}

export async function fetchUserRoleSettings(roleId: number): Promise<UserRoleSettings> {
  const response = await api.get<ApiResponse<UserRoleSettings>>(
    `/private/settings/userRole/${roleId}`
  )
  return unwrapApiResponse(response.data)
}

export async function updateDesignSettings(settings: Settings): Promise<void> {
  const response = await api.post<ApiResponse<unknown>>('/private/settings/design', settings)
  unwrapApiResponse(response.data)
}

export async function updateUserRolesCommonSettings(
  settings: UserRoleSettings[]
): Promise<void> {
  const response = await api.post<ApiResponse<unknown>>(
    '/private/settings/userRoles/common',
    settings
  )
  unwrapApiResponse(response.data)
}

export async function updateMiscSettings(settings: Settings): Promise<void> {
  const response = await api.post<ApiResponse<unknown>>('/private/settings/misc', settings)
  unwrapApiResponse(response.data)
}

export async function updateLanguageSettings(settings: Settings): Promise<void> {
  const response = await api.post<ApiResponse<unknown>>('/private/settings/lang', settings)
  unwrapApiResponse(response.data)
}

export const DEVICE_COLUMN_FIELDS: Array<{
  key: keyof UserRoleSettings
  labelKey: string
}> = [
  { key: 'columnDisplayedDeviceStatus', labelKey: 'settings.columns.status' },
  { key: 'columnDisplayedDeviceDate', labelKey: 'settings.columns.date' },
  { key: 'columnDisplayedDeviceNumber', labelKey: 'settings.columns.number' },
  { key: 'columnDisplayedDeviceImei', labelKey: 'settings.columns.imei' },
  { key: 'columnDisplayedDevicePhone', labelKey: 'settings.columns.phone' },
  { key: 'columnDisplayedDeviceModel', labelKey: 'settings.columns.model' },
  { key: 'columnDisplayedDeviceDesc', labelKey: 'settings.columns.description' },
  { key: 'columnDisplayedDeviceGroup', labelKey: 'settings.columns.group' },
  { key: 'columnDisplayedDeviceConfiguration', labelKey: 'settings.columns.configuration' },
  { key: 'columnDisplayedLauncherVersion', labelKey: 'settings.columns.launcher' },
  { key: 'columnDisplayedBatteryLevel', labelKey: 'settings.columns.battery' },
  { key: 'columnDisplayedAndroidVersion', labelKey: 'settings.columns.android' },
  { key: 'columnDisplayedEnrollmentDate', labelKey: 'settings.columns.enrollment' },
  { key: 'columnDisplayedSerial', labelKey: 'settings.columns.serial' },
  { key: 'columnDisplayedPublicIp', labelKey: 'settings.columns.publicIp' },
  { key: 'columnDisplayedMdmMode', labelKey: 'settings.columns.mdmMode' },
  { key: 'columnDisplayedKioskMode', labelKey: 'settings.columns.kioskMode' },
  { key: 'columnDisplayedDefaultLauncher', labelKey: 'settings.columns.defaultLauncher' },
  { key: 'columnDisplayedDevicePermissionsStatus', labelKey: 'settings.columns.permissions' },
  { key: 'columnDisplayedDeviceAppInstallStatus', labelKey: 'settings.columns.apps' },
  { key: 'columnDisplayedDeviceFilesStatus', labelKey: 'settings.columns.files' },
  { key: 'columnDisplayedCustom1', labelKey: 'settings.columns.custom1' },
  { key: 'columnDisplayedCustom2', labelKey: 'settings.columns.custom2' },
  { key: 'columnDisplayedCustom3', labelKey: 'settings.columns.custom3' },
]
