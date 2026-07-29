import type { QuickPolicyPreset } from '@/features/windows/configurations/constants/quick-policies-presets'
import { QUICK_POLICIES_PRESETS } from '@/features/windows/configurations/constants/quick-policies-presets'

/** Presets merged into payload fields — hidden from the restrictions UI. */
export const MERGED_PRESET_IDS = new Set([
  'force-defender-rtp',
  'usb-read-only',
  'inactivity-lock-15min',
])

export type DeviceRestrictionsGroupId =
  | 'securityDefender'
  | 'systemPrivacy'
  | 'hardwareUsb'
  | 'uiExperience'

export interface DeviceRestrictionsGroup {
  id: DeviceRestrictionsGroupId
  titleKey: string
  presetIds: string[]
}

export const DEVICE_RESTRICTIONS_GROUPS: DeviceRestrictionsGroup[] = [
  {
    id: 'securityDefender',
    titleKey: 'windowsConfigurations.deviceRestrictions.sections.securityDefender',
    presetIds: ['disable-llmnr'],
  },
  {
    id: 'systemPrivacy',
    titleKey: 'windowsConfigurations.deviceRestrictions.sections.systemPrivacy',
    presetIds: ['block-microsoft-accounts', 'prevent-update-reboot', 'disable-fast-startup'],
  },
  {
    id: 'hardwareUsb',
    titleKey: 'windowsConfigurations.deviceRestrictions.sections.hardwareUsb',
    presetIds: ['block-autorun'],
  },
  {
    id: 'uiExperience',
    titleKey: 'windowsConfigurations.deviceRestrictions.sections.uiExperience',
    presetIds: ['disable-consumer-features', 'enable-rdp'],
  },
]

const presetById = new Map(QUICK_POLICIES_PRESETS.map((preset) => [preset.id, preset]))

export function getPresetById(presetId: string): QuickPolicyPreset | undefined {
  return presetById.get(presetId)
}

export function syncQuickPolicyIdsWithPayload(
  payload: {
    defenderEnabled: boolean
    blockUsbStorage: boolean
    usbReadOnly: boolean
    screenLockTimeout: number
  },
  enabledPresetIds: string[],
): string[] {
  const withoutMerged = enabledPresetIds.filter((id) => !MERGED_PRESET_IDS.has(id))
  const synced = [...withoutMerged]

  if (payload.defenderEnabled && !synced.includes('force-defender-rtp')) {
    synced.push('force-defender-rtp')
  }

  if (payload.usbReadOnly && !payload.blockUsbStorage && !synced.includes('usb-read-only')) {
    synced.push('usb-read-only')
  }

  if (payload.screenLockTimeout === 15 && !synced.includes('inactivity-lock-15min')) {
    synced.push('inactivity-lock-15min')
  }

  return synced
}

export type UsbRestrictionMode = 'none' | 'readonly' | 'block'

export function usbModeFromPayload(blockUsbStorage: boolean, usbReadOnly: boolean): UsbRestrictionMode {
  if (blockUsbStorage) {
    return 'block'
  }
  if (usbReadOnly) {
    return 'readonly'
  }
  return 'none'
}

export function payloadFromUsbMode(mode: UsbRestrictionMode): {
  blockUsbStorage: boolean
  usbReadOnly: boolean
} {
  switch (mode) {
    case 'block':
      return { blockUsbStorage: true, usbReadOnly: false }
    case 'readonly':
      return { blockUsbStorage: false, usbReadOnly: true }
    default:
      return { blockUsbStorage: false, usbReadOnly: false }
  }
}

export function applyMergedPresetsToPayload(
  enabledPresetIds: string[],
): Partial<{
  defenderEnabled: boolean
  blockUsbStorage: boolean
  usbReadOnly: boolean
  screenLockTimeout: number
}> {
  const patch: Partial<{
    defenderEnabled: boolean
    blockUsbStorage: boolean
    usbReadOnly: boolean
    screenLockTimeout: number
  }> = {}

  if (enabledPresetIds.includes('force-defender-rtp')) {
    patch.defenderEnabled = true
  }
  if (enabledPresetIds.includes('usb-read-only')) {
    patch.usbReadOnly = true
    patch.blockUsbStorage = false
  }
  if (enabledPresetIds.includes('inactivity-lock-15min')) {
    patch.screenLockTimeout = 15
  }

  return patch
}

export function countDeviceRestrictions(
  payload: {
    defenderEnabled: boolean
    blockUsbStorage: boolean
    usbReadOnly: boolean
    screenLockTimeout: number
    requireBitLocker: boolean
  },
  enabledPresetIds: string[],
): number {
  let count = 0
  if (payload.defenderEnabled) count += 1
  if (payload.requireBitLocker) count += 1
  if (payload.blockUsbStorage || payload.usbReadOnly) count += 1
  if (payload.screenLockTimeout > 0) count += 1
  count += enabledPresetIds.filter((id) => !MERGED_PRESET_IDS.has(id)).length
  return count
}
