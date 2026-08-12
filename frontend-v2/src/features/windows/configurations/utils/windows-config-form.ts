import { z } from 'zod'
import type { ProfileAppAssignment } from '@/features/windows/applications/types/software-app'
import {
  DEFAULT_WINDOWS_CONFIG_PROFILE_PAYLOAD,
  type WindowsConfigProfile,
} from '@/features/windows/configurations/types/config-profile'
import {
  normalizeConfigProfilePayload,
  normalizeProfileAppAssignments,
} from '@/features/windows/configurations/utils/profile-app-assignments'

const profileAppAssignmentSchema = z.object({
  appId: z.number().int().positive(),
  versionId: z.number().int().positive().optional().nullable(),
})

export const configProfileFormSchema = z.object({
  name: z.string().trim().min(1, 'required'),
  description: z.string().optional(),
  isActive: z.boolean(),
  isDefault: z.boolean(),
  isPostEnrollmentDefault: z.boolean(),
  payload: z.object({
    defenderEnabled: z.boolean(),
    blockUsbStorage: z.boolean(),
    usbReadOnly: z.boolean(),
    screenLockTimeout: z.number().int().min(0),
    requireBitLocker: z.boolean(),
  }),
  groupIds: z.array(z.number().int().positive()),
  deviceIds: z.array(z.number().int().positive()),
  appAssignments: z.array(profileAppAssignmentSchema),
})

export type ConfigProfileFormValues = z.infer<typeof configProfileFormSchema>

export function sanitizeAssignmentIds(ids: unknown[] | undefined | null): number[] {
  if (!ids?.length) {
    return []
  }

  const seen = new Set<number>()
  const result: number[] = []

  for (const value of ids) {
    const parsed = typeof value === 'number' ? value : Number(value)
    if (!Number.isInteger(parsed) || parsed <= 0) {
      continue
    }
    if (seen.has(parsed)) {
      continue
    }
    seen.add(parsed)
    result.push(parsed)
  }

  return result
}

export function buildConfigProfileAssignmentsPayload(
  groupIds: unknown[] | undefined | null,
  deviceIds: unknown[] | undefined | null,
  options?: { allowedGroupIds?: Iterable<number>; allowedDeviceIds?: Iterable<number> },
) {
  const allowedGroupIds = options?.allowedGroupIds ? new Set(options.allowedGroupIds) : null
  const allowedDeviceIds = options?.allowedDeviceIds ? new Set(options.allowedDeviceIds) : null

  const normalizedGroupIds = sanitizeAssignmentIds(groupIds).filter(
    (id) => allowedGroupIds == null || allowedGroupIds.has(id),
  )
  const normalizedDeviceIds = sanitizeAssignmentIds(deviceIds).filter(
    (id) => allowedDeviceIds == null || allowedDeviceIds.has(id),
  )

  return {
    groupIds: normalizedGroupIds,
    deviceIds: normalizedDeviceIds,
  }
}

export function createEmptyConfigProfileFormValues(): ConfigProfileFormValues {
  return {
    name: '',
    description: '',
    isActive: false,
    isDefault: false,
    isPostEnrollmentDefault: false,
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

  const appAssignments = normalizeProfileAppAssignments(
    profileApps?.assignments ??
      (profileApps?.appIds ?? []).map((appId) => ({ appId })),
  )

  return {
    name: profile.name,
    description: profile.description ?? '',
    isActive: profile.isActive,
    isDefault: profile.isDefault,
    isPostEnrollmentDefault: profile.isPostEnrollmentDefault ?? false,
    payload: normalizeConfigProfilePayload(profile.payload),
    groupIds: sanitizeAssignmentIds(assignments?.groupIds),
    deviceIds: sanitizeAssignmentIds(assignments?.deviceIds),
    appAssignments,
  }
}
