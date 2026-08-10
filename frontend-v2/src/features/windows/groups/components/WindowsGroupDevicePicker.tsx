import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Loader2, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export interface WindowsGroupDeviceOption {
  id: number
  label: string
}

interface WindowsGroupDevicePickerProps {
  id: string
  label: string
  options: WindowsGroupDeviceOption[]
  selectedIds: number[]
  onChange: (selectedIds: number[]) => void
  isLoading?: boolean
}

export function WindowsGroupDevicePicker({
  id,
  label,
  options,
  selectedIds,
  onChange,
  isLoading = false,
}: WindowsGroupDevicePickerProps) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')

  const filteredOptions = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) {
      return options
    }
    return options.filter((option) => option.label.toLowerCase().includes(query))
  }, [options, search])

  const toggleDevice = (deviceId: number) => {
    if (selectedIds.includes(deviceId)) {
      onChange(selectedIds.filter((value) => value !== deviceId))
      return
    }
    onChange([...selectedIds, deviceId])
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="rounded-lg border border-white/10 bg-black/20">
        <div className="border-b border-white/10 p-2">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id={id}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('windowsGroups.form.devicesSearchPlaceholder')}
              className="border-white/10 bg-[#111] pl-8"
              disabled={isLoading}
            />
          </div>
        </div>

        <div className="max-h-52 overflow-y-auto p-2">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {t('common.loading')}
            </div>
          ) : filteredOptions.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t('windowsGroups.form.devicesEmpty')}
            </p>
          ) : (
            <ul className="space-y-1">
              {filteredOptions.map((option) => {
                const checked = selectedIds.includes(option.id)
                return (
                  <li key={option.id}>
                    <button
                      type="button"
                      onClick={() => toggleDevice(option.id)}
                      className={cn(
                        'flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                        'hover:bg-white/5',
                        checked && 'bg-white/[0.03]',
                      )}
                    >
                      <span
                        className={cn(
                          'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border border-white/20',
                          checked && 'border-blue-500/60 bg-blue-500/20 text-blue-300',
                        )}
                        aria-hidden
                      >
                        {checked ? <Check className="size-3" /> : null}
                      </span>
                      <span className="min-w-0 leading-snug text-slate-200">{option.label}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {t('windowsGroups.form.devicesSelectedCount', { count: selectedIds.length })}
      </p>
    </div>
  )
}
