import { ChevronDown } from 'lucide-react'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

export interface FlatSelectOption {
  value: string
  label: string
  disabled?: boolean
}

interface FlatSelectProps {
  value: string
  onChange: (value: string) => void
  options: FlatSelectOption[]
  disabled?: boolean
  placeholder?: string
  className?: string
  id?: string
}

const triggerClassName =
  'flex h-9 w-full items-center justify-between gap-2 border border-zinc-700 bg-zinc-800/80 px-3 text-sm text-zinc-100 outline-none transition-colors hover:border-zinc-600 focus-visible:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-50 appearance-none'

const menuClassName =
  'fixed z-[9999] max-h-60 overflow-y-auto border border-zinc-700 bg-zinc-800 py-1'

const optionClassName =
  'flex w-full cursor-pointer items-center px-3 py-2 text-left text-sm text-zinc-200 outline-none hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50'

export function FlatSelect({
  value,
  onChange,
  options,
  disabled = false,
  placeholder,
  className,
  id,
}: FlatSelectProps) {
  const fallbackId = useId()
  const triggerId = id ?? fallbackId
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [menuStyle, setMenuStyle] = useState<{ top: number; left: number; width: number }>({
    top: 0,
    left: 0,
    width: 0,
  })

  const selectedLabel = options.find((option) => option.value === value)?.label

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

  const selectOption = (nextValue: string) => {
    onChange(nextValue)
    setOpen(false)
  }

  return (
    <>
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(triggerClassName, className)}
        onClick={() => {
          if (disabled) {
            return
          }
          setOpen((current) => !current)
        }}
      >
        <span className={cn('truncate', !selectedLabel && 'text-zinc-500')}>
          {selectedLabel ?? placeholder ?? '—'}
        </span>
        <ChevronDown className={cn('size-4 shrink-0 text-zinc-500 transition-transform', open && 'rotate-180')} />
      </button>

      {open
        ? createPortal(
            <div
              ref={menuRef}
              role="listbox"
              aria-labelledby={triggerId}
              className={menuClassName}
              style={{
                top: menuStyle.top,
                left: menuStyle.left,
                width: menuStyle.width,
              }}
            >
              {options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={option.value === value}
                  disabled={option.disabled}
                  className={cn(
                    optionClassName,
                    option.value === value && 'bg-zinc-700/80 text-zinc-50',
                  )}
                  onClick={() => selectOption(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
