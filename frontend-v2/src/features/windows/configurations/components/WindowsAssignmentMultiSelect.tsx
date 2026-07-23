import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, ChevronsUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export interface AssignmentOption {
  value: number
  label: string
}

interface WindowsAssignmentMultiSelectProps {
  id: string
  label: string
  options: AssignmentOption[]
  selectedIds: number[]
  onChange: (selectedIds: number[]) => void
  disabled?: boolean
  emptyLabel?: string
}

export function WindowsAssignmentMultiSelect({
  id,
  label,
  options,
  selectedIds,
  onChange,
  disabled = false,
  emptyLabel,
}: WindowsAssignmentMultiSelectProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  const selectedLabels = useMemo(
    () =>
      selectedIds
        .map((value) => options.find((option) => option.value === value)?.label)
        .filter((value): value is string => Boolean(value)),
    [options, selectedIds],
  )

  const toggleValue = (value: number) => {
    if (selectedIds.includes(value)) {
      onChange(selectedIds.filter((item) => item !== value))
      return
    }
    onChange([...selectedIds, value])
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Button
          id={id}
          type="button"
          variant="outline"
          className="w-full justify-between font-normal"
          disabled={disabled}
          onClick={() => setOpen((current) => !current)}
        >
          <span className="truncate text-left">
            {selectedLabels.length > 0
              ? selectedLabels.join(', ')
              : t('windowsConfigurations.assignments.noneSelected')}
          </span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
        {open ? (
          <div className="absolute z-20 mt-1 w-full rounded-lg border bg-popover shadow-md">
            <Command>
              <CommandInput placeholder={t('windowsConfigurations.assignments.search')} />
              <CommandList>
                <CommandEmpty>{emptyLabel ?? t('windowsConfigurations.assignments.empty')}</CommandEmpty>
                <CommandGroup>
                  {options.map((option) => {
                    const selected = selectedIds.includes(option.value)
                    return (
                      <CommandItem
                        key={option.value}
                        value={option.label}
                        onSelect={() => toggleValue(option.value)}
                      >
                        <Check className={cn('mr-2 size-4', selected ? 'opacity-100' : 'opacity-0')} />
                        {option.label}
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </div>
        ) : null}
      </div>
      {selectedIds.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          {t('windowsConfigurations.assignments.selectedCount', { count: selectedIds.length })}
        </p>
      ) : null}
    </div>
  )
}
