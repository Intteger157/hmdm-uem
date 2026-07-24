import { z } from 'zod'
import type { ProfileAppAssignment } from '@/features/windows/applications/types/software-app'
import {
  DEFAULT_WINDOWS_CONFIG_PROFILE_PAYLOAD,
  type WindowsConfigProfile,
} from '@/features/windows/configurations/types/config-profile'

const profileAppAssignmentSchema = z.object({
  appId: z.number().int().positive(),
  versionId: z.number().int().positive().optional().nullable(),
})

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
  appAssignments: z.array(profileAppAssignmentSchema),
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
    appAssignments: [],
  }
}

export function toConfigProfileFormValues(
  profile: WindowsConfigProfile | null,
  assignments?: { groupIds: number[]; deviceIds: number[] },
  profileApps?: { appIds: number[]; assignments?: ProfileAppAssignment[] },
): ConfigProfileFormValues {
  if (!profile) {
    return createEmptyConfigProfileFormValues()
  }

  const appAssignments =
    profileApps?.assignments ??
    (profileApps?.appIds ?? []).map((appId) => ({ appId }))

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
    appAssignments,
  }
}
