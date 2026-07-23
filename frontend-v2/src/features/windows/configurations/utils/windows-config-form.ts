import { z } from 'zod'
import {
  DEFAULT_WINDOWS_CONFIG_PROFILE_PAYLOAD,
  type WindowsConfigProfile,
} from '@/features/windows/configurations/types/config-profile'

export const configProfileFormSchema = z.object({
  name: z.string().trim().min(1, 'required'),
  description: z.string().optional(),
  isActive: z.boolean(),
  payload: z.object({
    defenderEnabled: z.boolean(),
    blockUsbStorage: z.boolean(),
    usbReadOnly: z.boolean(),
    screenLockTimeout: z.number().int().min(0),
  }),
  groupIds: z.array(z.number().int().positive()),
  deviceIds: z.array(z.number().int().positive()),
  appIds: z.array(z.number().int().positive()),
})

export type ConfigProfileFormValues = z.infer<typeof configProfileFormSchema>

export function createEmptyConfigProfileFormValues(): ConfigProfileFormValues {
  return {
    name: '',
    description: '',
    isActive: false,
    payload: { ...DEFAULT_WINDOWS_CONFIG_PROFILE_PAYLOAD },
    groupIds: [],
    deviceIds: [],
    appIds: [],
  }
}

export function toConfigProfileFormValues(
  profile: WindowsConfigProfile | null,
  assignments?: { groupIds: number[]; deviceIds: number[] },
  profileApps?: { appIds: number[] },
): ConfigProfileFormValues {
  if (!profile) {
    return createEmptyConfigProfileFormValues()
  }

  return {
    name: profile.name,
    description: profile.description ?? '',
    isActive: profile.isActive,
    payload: {
      defenderEnabled: profile.payload.defenderEnabled,
      blockUsbStorage: profile.payload.blockUsbStorage,
      usbReadOnly: profile.payload.usbReadOnly ?? false,
      screenLockTimeout: profile.payload.screenLockTimeout,
    },
    groupIds: assignments?.groupIds ?? [],
    deviceIds: assignments?.deviceIds ?? [],
    appIds: profileApps?.appIds ?? [],
  }
}
