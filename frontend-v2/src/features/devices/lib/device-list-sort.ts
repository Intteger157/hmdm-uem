import type { DeviceListSortBy } from '@/shared/api/types/device'

export interface DeviceListSortPreset {
  id: string
  sortBy: DeviceListSortBy
  sortDir: 'ASC' | 'DESC'
  labelKey: string
}

export const DEVICE_LIST_SORT_PRESETS: Record<'android' | 'windows', DeviceListSortPreset[]> = {
  windows: [
    { id: 'hostname-asc', sortBy: 'HOSTNAME', sortDir: 'ASC', labelKey: 'devices.sort.hostnameAsc' },
    { id: 'hostname-desc', sortBy: 'HOSTNAME', sortDir: 'DESC', labelKey: 'devices.sort.hostnameDesc' },
    { id: 'last-update-desc', sortBy: 'LAST_UPDATE', sortDir: 'DESC', labelKey: 'devices.sort.lastUpdateDesc' },
    { id: 'last-update-asc', sortBy: 'LAST_UPDATE', sortDir: 'ASC', labelKey: 'devices.sort.lastUpdateAsc' },
    { id: 'user-asc', sortBy: 'CURRENT_USER', sortDir: 'ASC', labelKey: 'devices.sort.currentUserAsc' },
  ],
  android: [
    { id: 'number-asc', sortBy: 'NUMBER', sortDir: 'ASC', labelKey: 'devices.sort.numberAsc' },
    { id: 'number-desc', sortBy: 'NUMBER', sortDir: 'DESC', labelKey: 'devices.sort.numberDesc' },
    { id: 'last-update-desc', sortBy: 'LAST_UPDATE', sortDir: 'DESC', labelKey: 'devices.sort.lastUpdateDesc' },
    { id: 'last-update-asc', sortBy: 'LAST_UPDATE', sortDir: 'ASC', labelKey: 'devices.sort.lastUpdateAsc' },
    { id: 'description-asc', sortBy: 'DESCRIPTION', sortDir: 'ASC', labelKey: 'devices.sort.descriptionAsc' },
  ],
}

const STORAGE_KEY = 'hmdm-devices-list-sort-v1'

export function defaultSortPresetId(platform: 'android' | 'windows'): string {
  return platform === 'windows' ? 'hostname-asc' : 'number-asc'
}

export function loadSortPresetId(platform: 'android' | 'windows'): string {
  if (typeof window === 'undefined') {
    return defaultSortPresetId(platform)
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return defaultSortPresetId(platform)
    }
    const parsed = JSON.parse(raw) as Partial<Record<'android' | 'windows', string>>
    const presetId = parsed[platform]
    if (presetId && DEVICE_LIST_SORT_PRESETS[platform].some((preset) => preset.id === presetId)) {
      return presetId
    }
  } catch {
    // ignore corrupt storage
  }
  return defaultSortPresetId(platform)
}

export function saveSortPresetId(platform: 'android' | 'windows', presetId: string) {
  if (typeof window === 'undefined') {
    return
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? (JSON.parse(raw) as Partial<Record<'android' | 'windows', string>>) : {}
    parsed[platform] = presetId
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed))
  } catch {
    // ignore quota errors
  }
}

export function resolveSortPreset(
  platform: 'android' | 'windows',
  presetId: string,
): DeviceListSortPreset {
  return (
    DEVICE_LIST_SORT_PRESETS[platform].find((preset) => preset.id === presetId) ??
    DEVICE_LIST_SORT_PRESETS[platform].find((preset) => preset.id === defaultSortPresetId(platform))!
  )
}
