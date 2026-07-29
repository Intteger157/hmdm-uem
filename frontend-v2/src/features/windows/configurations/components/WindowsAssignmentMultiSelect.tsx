import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, ChevronsUpDown } from 'lucide-react'
import { createPortal } from 'react-dom'
import { sanitizeAssignmentIds } from '@/features/windows/configurations/utils/windows-config-form'
import { formatDisplayText } from '@/features/windows/configurations/utils/profile-app-assignments'
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
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [menuStyle, setMenuStyle] = useState<{ top: number; left: number; width: number }>({
    top: 0,
    left: 0,
    width: 0,
  })

  const normalizedSelectedIds = useMemo(
    () => sanitizeAssignmentIds(selectedIds as unknown[]),
    [selectedIds],
  )

  const selectedLabels = useMemo(
    () =>
      normalizedSelectedIds
        .map((value) => options.find((option) => option.value === value)?.label)
        .map((label) => formatDisplayText(label))
        .filter((value): value is string => value.length > 0 && value !== '—'),
    [normalizedSelectedIds, options],
  )

  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) {
      return
    }

    const rect = trigger.getBoundingClientRect()
    setMenuStyle({
      top: rect.bottom + 2,
      left: rect.left,
      width: rect.width,
    })
  }, [])

  useEffect(() => {
    if (!open) {
      return
    }

    updateMenuPosition()

    const handleScrollOrResize = () => updateMenuPosition()
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return
      }
      setOpen(false)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    window.addEventListener('scroll', handleScrollOrResize, true)
    window.addEventListener('resize', handleScrollOrResize)
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true)
      window.removeEventListener('resize', handleScrollOrResize)
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, updateMenuPosition])

  const toggleValue = (value: number) => {
    if (normalizedSelectedIds.includes(value)) {
      onChange(normalizedSelectedIds.filter((item) => item !== value))
      return
    }
    onChange([...normalizedSelectedIds, value])
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Button
        ref={triggerRef}
        id={id}
        type="button"
        variant="outline"
        className="w-full justify-between border-zinc-700 bg-zinc-800/80 font-normal hover:border-zinc-600 hover:bg-zinc-800 focus-visible:border-zinc-500 focus-visible:ring-0"
        disabled={disabled}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="truncate text-left">
          {selectedLabels.length > 0
            ? selectedLabels.join(', ')
            : t('windowsConfigurations.assignments.noneSelected')}
        </span>
        <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
      </Button>

      {open
        ? createPortal(
            <div
              ref={menuRef}
              className="fixed z-[9999] border border-zinc-700 bg-zinc-800"
              style={{
                top: menuStyle.top,
                left: menuStyle.left,
                width: menuStyle.width,
              }}
            >
              <Command className="bg-zinc-800">
                <CommandInput
                  placeholder={t('windowsConfigurations.assignments.search')}
                  className="border-zinc-700"
                />
                <CommandList>
                  <CommandEmpty>{emptyLabel ?? t('windowsConfigurations.assignments.empty')}</CommandEmpty>
                  <CommandGroup>
                    {options.map((option) => {
                      const selected = normalizedSelectedIds.includes(option.value)
                      return (
                        <CommandItem
                          key={option.value}
                          value={formatDisplayText(option.label)}
                          className="rounded-none aria-selected:bg-zinc-700"
                          onSelect={() => toggleValue(option.value)}
                        >
                          <Check className={cn('mr-2 size-4', selected ? 'opacity-100' : 'opacity-0')} />
                          {formatDisplayText(option.label)}
                        </CommandItem>
                      )
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </div>,
            document.body,
          )
        : null}

      {normalizedSelectedIds.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          {t('windowsConfigurations.assignments.selectedCount', { count: normalizedSelectedIds.length })}
        </p>
      ) : null}
    </div>
  )
}
