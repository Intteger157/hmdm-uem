import { useTranslation } from 'react-i18next'
import { FlatSelect } from '@/components/ui/flat-select'
import {
  DEVICE_LIST_SORT_PRESETS,
  type DeviceListSortPreset,
} from '@/features/devices/lib/device-list-sort'
import type { Platform } from '@/shared/api/types/platform'

interface DeviceListSortSelectProps {
  platform: Platform
  value: string
  onChange: (presetId: string) => void
}

export function DeviceListSortSelect({ platform, value, onChange }: DeviceListSortSelectProps) {
  const { t } = useTranslation()
  const presets = DEVICE_LIST_SORT_PRESETS[platform]

  return (
    <FlatSelect
      id={`device-list-sort-${platform}`}
      value={value}
      onChange={onChange}
      options={presets.map((preset: DeviceListSortPreset) => ({
        value: preset.id,
        label: t(preset.labelKey),
      }))}
      placeholder={t('devices.sort.label')}
      className="min-w-[11rem]"
    />
  )
}
