import { cn } from '@/lib/utils'

export type TriStateValue = boolean | null | undefined

interface TriStateRadioProps {
  name: string
  value: TriStateValue
  onChange: (value: boolean | null) => void
  labels?: { any: string; disabled: string; enabled: string }
  className?: string
  disabled?: boolean
}

const defaultLabels = {
  any: 'Any',
  disabled: 'Disabled',
  enabled: 'Enabled',
}

export function TriStateRadio({
  name,
  value,
  onChange,
  labels = defaultLabels,
  className,
  disabled = false,
}: TriStateRadioProps) {
  const normalized = value === undefined ? null : value

  return (
    <div className={cn('flex flex-wrap gap-4', className)}>
      {(
        [
          { key: 'any', val: null as boolean | null, label: labels.any },
          { key: 'off', val: false as boolean | null, label: labels.disabled },
          { key: 'on', val: true as boolean | null, label: labels.enabled },
        ] as const
      ).map((option) => (
        <label
          key={option.key}
          className={cn(
            'flex cursor-pointer items-center gap-2 text-sm',
            disabled && 'cursor-not-allowed opacity-60'
          )}
        >
          <input
            type="radio"
            name={name}
            checked={normalized === option.val}
            disabled={disabled}
            onChange={() => onChange(option.val)}
          />
          {option.label}
        </label>
      ))}
    </div>
  )
}
