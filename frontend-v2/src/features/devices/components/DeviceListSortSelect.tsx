import { ArrowDownUp, ChevronDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { NativeSelect } from '@/components/ui/native-select'
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
  const selectId = `device-list-sort-${platform}`

  return (
    <div className="relative shrink-0">
      <ArrowDownUp
        className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <NativeSelect
        id={selectId}
        aria-label={t('devices.sort.label')}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-[15rem] border-border/80 bg-card pl-9 pr-8 dark:border-[#242424] dark:bg-[#111111]"
      >
        {presets.map((preset: DeviceListSortPreset) => (
          <option key={preset.id} value={preset.id}>
            {t(preset.labelKey)}
          </option>
        ))}
      </NativeSelect>
      <ChevronDown
        className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
    </div>
  )
}
